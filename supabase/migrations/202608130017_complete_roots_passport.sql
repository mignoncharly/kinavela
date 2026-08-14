begin;

alter table public.roots_passport_exports
  add column attempts smallint not null default 0 check (attempts between 0 and 10),
  add column error_code text check (error_code is null or char_length(error_code) between 3 and 80),
  add column updated_at timestamptz not null default now();

create trigger roots_passport_exports_set_updated_at
  before update on public.roots_passport_exports
  for each row execute function public.set_updated_at();

create table public.roots_entry_sharing_history (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.roots_passport_entries(id) on delete cascade,
  changed_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  previous_visibility text not null check (previous_visibility in ('private','family','village')),
  new_visibility text not null check (new_visibility in ('private','family','village')),
  previous_village_id uuid references public.villages(id) on delete set null,
  new_village_id uuid references public.villages(id) on delete set null,
  changed_at timestamptz not null default now(),
  check ((new_visibility = 'village' and new_village_id is not null)
    or new_visibility <> 'village')
);
create index roots_entry_sharing_history_entry_idx
  on public.roots_entry_sharing_history(entry_id, changed_at desc);
alter table public.roots_entry_sharing_history enable row level security;
alter table public.roots_entry_sharing_history force row level security;
revoke all on public.roots_entry_sharing_history from public, anon, authenticated;

create or replace function public.list_roots_passport_entries_v2(p_child_id uuid)
returns table (
  entry_id uuid, passport_id uuid, child_id uuid, type text, title text,
  description text, culture_id uuid, culture_name text, language_id uuid,
  language_name text, event_id uuid, event_title text, mission_id uuid,
  mission_title text, village_id uuid, village_name text, occurred_at timestamptz,
  visibility text, media_kind text, media_mime_type text,
  media_size_bytes bigint, media_available boolean, created_at timestamptz,
  updated_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
declare passport_uuid uuid;
begin
  if public.current_profile_id() is null then raise exception 'not_authenticated'; end if;
  select passport.id into passport_uuid from public.roots_passports passport
  where passport.child_id = p_child_id;
  if passport_uuid is null or not kinavela_private.can_manage_roots_passport(passport_uuid)
  then raise exception 'not_authorized'; end if;
  return query
  select entry.id, entry.passport_id, p_child_id, entry.type, entry.title,
    entry.description, entry.culture_id, culture.name, entry.language_id,
    language.name, entry.event_id, event.title, entry.mission_id, mission.title,
    entry.village_id, village.name, entry.occurred_at, entry.visibility,
    entry.media_kind, entry.media_mime_type, entry.media_size_bytes,
    entry.media_path is not null, entry.created_at, entry.updated_at
  from public.roots_passport_entries entry
  left join public.cultures culture on culture.id = entry.culture_id
  left join public.languages language on language.id = entry.language_id
  left join public.events event on event.id = entry.event_id
  left join public.cultural_missions mission on mission.id = entry.mission_id
  left join public.villages village on village.id = entry.village_id
  where entry.passport_id = passport_uuid
  order by entry.occurred_at desc, entry.created_at desc, entry.id;
end;
$$;

create or replace function public.get_roots_passport_options(p_child_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare passport_uuid uuid; family_uuid uuid; result jsonb;
begin
  if public.current_profile_id() is null then raise exception 'not_authenticated'; end if;
  select passport.id, child.family_id into passport_uuid, family_uuid
  from public.roots_passports passport join public.children child on child.id = passport.child_id
  where child.id = p_child_id;
  if passport_uuid is null or not kinavela_private.can_manage_roots_passport(passport_uuid)
  then raise exception 'not_authorized'; end if;
  select jsonb_build_object(
    'cultures', coalesce((select jsonb_agg(jsonb_build_object('id', culture.id, 'name', culture.name)
      order by culture.name, culture.id) from public.cultures culture), '[]'::jsonb),
    'languages', coalesce((select jsonb_agg(jsonb_build_object('id', language.id, 'name', language.name)
      order by language.name, language.id) from public.languages language), '[]'::jsonb),
    'missions', coalesce((select jsonb_agg(jsonb_build_object('id', mission.id, 'name', mission.title)
      order by mission.title, mission.id) from public.cultural_missions mission where exists (
        select 1 from public.family_mission_progress progress
        where progress.family_id = family_uuid and progress.mission_id = mission.id
          and progress.status = 'completed')), '[]'::jsonb),
    'villages', coalesce((select jsonb_agg(jsonb_build_object('id', village.id, 'name', village.name)
      order by village.name, village.id) from public.villages village where exists (
        select 1 from public.village_members member where member.village_id = village.id
          and member.family_id = family_uuid and member.status = 'active')
          and village.status = 'active'), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(jsonb_build_object(
        'id', event.id, 'name', event.title, 'village_id', event.village_id)
      order by event.starts_at desc, event.id) from public.events event where exists (
        select 1 from public.village_members member where member.village_id = event.village_id
          and member.family_id = family_uuid and member.status = 'active')), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

create or replace function public.update_roots_passport_entry(
  p_entry_id uuid, p_payload jsonb
)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  profile_uuid uuid := public.current_profile_id();
  entry_row public.roots_passport_entries%rowtype;
  child_family_uuid uuid;
  clean_title text := btrim(coalesce(p_payload->>'title',''));
  clean_description text := nullif(btrim(coalesce(p_payload->>'description','')), '');
  entry_type text := p_payload->>'type';
  entry_visibility text := p_payload->>'visibility';
  culture_uuid uuid := nullif(p_payload->>'culture_id','')::uuid;
  language_uuid uuid := nullif(p_payload->>'language_id','')::uuid;
  event_uuid uuid := nullif(p_payload->>'event_id','')::uuid;
  mission_uuid uuid := nullif(p_payload->>'mission_id','')::uuid;
  village_uuid uuid := nullif(p_payload->>'village_id','')::uuid;
  occurred_value timestamptz := nullif(p_payload->>'occurred_at','')::timestamptz;
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  select * into entry_row from public.roots_passport_entries where id = p_entry_id for update;
  if entry_row.id is null or not kinavela_private.can_manage_roots_passport(entry_row.passport_id)
  then raise exception 'not_authorized'; end if;
  select child.family_id into child_family_uuid from public.roots_passports passport
    join public.children child on child.id = passport.child_id
    where passport.id = entry_row.passport_id;
  if char_length(clean_title) not between 2 and 160
    or clean_description is not null and char_length(clean_description) > 5000
    or entry_type not in ('language','story','recipe','place','tradition','event',
      'family_memory','achievement','trip','photo','audio','video','document')
    or entry_visibility not in ('private','family','village')
    or occurred_value is null or occurred_value > now() + interval '1 day'
  then raise exception 'invalid_entry'; end if;
  if culture_uuid is not null and not exists (select 1 from public.cultures where id=culture_uuid)
    or language_uuid is not null and not exists (select 1 from public.languages where id=language_uuid)
  then raise exception 'metadata_not_available'; end if;
  if mission_uuid is not null and not exists (
    select 1 from public.family_mission_progress where family_id=child_family_uuid
      and mission_id=mission_uuid and status='completed')
  then raise exception 'mission_not_completed'; end if;
  if event_uuid is not null and not exists (
    select 1 from public.events event join public.village_members member
      on member.village_id=event.village_id and member.family_id=child_family_uuid
      and member.status='active' where event.id=event_uuid)
  then raise exception 'event_not_available'; end if;
  if entry_visibility='village' and (village_uuid is null or not exists (
    select 1 from public.village_members where village_id=village_uuid
      and family_id=child_family_uuid and status='active'))
  then raise exception 'village_not_available'; end if;
  if entry_visibility <> 'village' then village_uuid := null; end if;

  update public.roots_passport_entries set type=entry_type, title=clean_title,
    description=clean_description, culture_id=culture_uuid, language_id=language_uuid,
    event_id=event_uuid, mission_id=mission_uuid, village_id=village_uuid,
    occurred_at=occurred_value, visibility=entry_visibility, updated_at=now()
  where id=p_entry_id;
  if entry_row.visibility is distinct from entry_visibility
    or entry_row.village_id is distinct from village_uuid then
    insert into public.roots_entry_sharing_history(
      entry_id, changed_by_profile_id, previous_visibility, new_visibility,
      previous_village_id, new_village_id
    ) values (p_entry_id, profile_uuid, entry_row.visibility, entry_visibility,
      entry_row.village_id, village_uuid);
    insert into public.audit_events(actor_profile_id,event_type,entity_type,entity_id,metadata)
    values(profile_uuid,'roots_entry_sharing_changed','roots_passport_entry',p_entry_id,
      jsonb_build_object('previous_visibility',entry_row.visibility,
        'new_visibility',entry_visibility,'previous_village_id',entry_row.village_id,
        'new_village_id',village_uuid));
  end if;
  return true;
end;
$$;

create or replace function public.list_roots_entry_sharing_history(p_entry_id uuid)
returns table(previous_visibility text,new_visibility text,previous_village_name text,
  new_village_name text,changed_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.roots_passport_entries entry where entry.id=p_entry_id
    and kinavela_private.can_manage_roots_passport(entry.passport_id))
  then raise exception 'not_authorized'; end if;
  return query select history.previous_visibility, history.new_visibility,
    previous_village.name, new_village.name, history.changed_at
  from public.roots_entry_sharing_history history
  left join public.villages previous_village on previous_village.id=history.previous_village_id
  left join public.villages new_village on new_village.id=history.new_village_id
  where history.entry_id=p_entry_id order by history.changed_at desc, history.id desc;
end;
$$;

create or replace function public.get_roots_media_path(p_entry_id uuid)
returns table(media_path text,media_kind text,media_mime_type text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if public.current_profile_id() is null or not kinavela_private.can_view_roots_entry(p_entry_id)
  then raise exception 'not_authorized'; end if;
  return query select entry.media_path,entry.media_kind,entry.media_mime_type
  from public.roots_passport_entries entry
  where entry.id=p_entry_id and entry.media_path is not null;
end;
$$;

create or replace function public.replace_roots_media(
  p_entry_id uuid,p_media_path text,p_media_kind text,p_media_mime_type text,
  p_media_size_bytes bigint
)
returns text
language plpgsql security definer set search_path = '' as $$
declare entry_row public.roots_passport_entries%rowtype; old_path text;
begin
  select * into entry_row from public.roots_passport_entries where id=p_entry_id for update;
  if entry_row.id is null or not kinavela_private.can_manage_roots_passport(entry_row.passport_id)
  then raise exception 'not_authorized'; end if;
  if split_part(p_media_path,'/',1)<>entry_row.passport_id::text
    or split_part(p_media_path,'/',2)<>entry_row.id::text
    or p_media_kind not in ('photo','audio','video','document')
    or p_media_size_bytes not between 1 and 25000000
  then raise exception 'invalid_media'; end if;
  old_path := entry_row.media_path;
  update public.roots_passport_entries set media_path=p_media_path,
    media_kind=p_media_kind,media_mime_type=p_media_mime_type,
    media_size_bytes=p_media_size_bytes,updated_at=now() where id=p_entry_id;
  insert into public.audit_events(actor_profile_id,event_type,entity_type,entity_id,
    metadata) values(public.current_profile_id(),'roots_media_replaced',
      'roots_passport_entry',p_entry_id,jsonb_build_object('media_kind',p_media_kind));
  return old_path;
end;
$$;

create or replace function public.detach_roots_media(p_entry_id uuid)
returns text
language plpgsql security definer set search_path = '' as $$
declare entry_row public.roots_passport_entries%rowtype;
begin
  select * into entry_row from public.roots_passport_entries where id=p_entry_id for update;
  if entry_row.id is null or not kinavela_private.can_manage_roots_passport(entry_row.passport_id)
  then raise exception 'not_authorized'; end if;
  update public.roots_passport_entries set media_path=null,media_kind=null,
    media_mime_type=null,media_size_bytes=null,updated_at=now() where id=p_entry_id;
  insert into public.audit_events(actor_profile_id,event_type,entity_type,entity_id)
    values(public.current_profile_id(),'roots_media_deleted','roots_passport_entry',p_entry_id);
  return entry_row.media_path;
end;
$$;

create or replace function public.delete_roots_passport_entry_v2(p_entry_id uuid)
returns text
language plpgsql security definer set search_path = '' as $$
declare profile_uuid uuid:=public.current_profile_id(); entry_row public.roots_passport_entries%rowtype;
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  select * into entry_row from public.roots_passport_entries where id=p_entry_id for update;
  if entry_row.id is null or not kinavela_private.can_manage_roots_passport(entry_row.passport_id)
  then raise exception 'not_authorized'; end if;
  delete from public.roots_passport_entries where id=p_entry_id;
  insert into public.audit_events(actor_profile_id,event_type,entity_type,entity_id)
    values(profile_uuid,'roots_entry_deleted','roots_passport_entry',p_entry_id);
  return entry_row.media_path;
end;
$$;

create or replace function public.claim_roots_passport_export()
returns table(export_id uuid,passport_id uuid,requested_by_profile_id uuid)
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'service_role_required'; end if;
  update public.roots_passport_exports set status='failed',error_code='worker_timeout'
    where status='processing' and updated_at<now()-interval '20 minutes';
  return query with picked as (
    select export.id from public.roots_passport_exports export
    where export.status='queued' order by export.requested_at for update skip locked limit 1
  ), claimed as (
    update public.roots_passport_exports export set status='processing',
      attempts=attempts+1,error_code=null,updated_at=now()
    where export.id in(select id from picked)
    returning export.id,export.passport_id,export.requested_by_profile_id
  ) select * from claimed;
end;
$$;

create or replace function public.get_roots_passport_export_payload(p_export_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'service_role_required'; end if;
  select jsonb_build_object(
    'format','kinavela-roots-passport-v1','exported_at',now(),
    'child',jsonb_build_object('nickname',child.nickname),
    'timeline',coalesce((select jsonb_agg(jsonb_build_object(
      'type',entry.type,'title',entry.title,'description',entry.description,
      'occurred_at',entry.occurred_at,'visibility',entry.visibility,
      'culture',culture.name,'language',language.name,'mission',mission.title,
      'event',event.title,'village',village.name,
      'media',case when entry.media_path is null then null else jsonb_build_object(
        'included_in_archive',false,
        'reason','Media files remain in private storage and are available through authorized Passport access.',
        'kind',entry.media_kind,'mime_type',entry.media_mime_type,
        'size_bytes',entry.media_size_bytes) end
    ) order by entry.occurred_at,entry.created_at) from public.roots_passport_entries entry
      left join public.cultures culture on culture.id=entry.culture_id
      left join public.languages language on language.id=entry.language_id
      left join public.cultural_missions mission on mission.id=entry.mission_id
      left join public.events event on event.id=entry.event_id
      left join public.villages village on village.id=entry.village_id
      where entry.passport_id=export.passport_id),'[]'::jsonb),
    'media_manifest_note','Media is not copied into this JSON archive. The manifest records kind, MIME type and size without exposing private storage paths.'
  ) into result from public.roots_passport_exports export
  join public.roots_passports passport on passport.id=export.passport_id
  join public.children child on child.id=passport.child_id
  where export.id=p_export_id and export.status='processing';
  if result is null then raise exception 'export_not_processing'; end if;
  return result;
end;
$$;

create or replace function public.complete_roots_passport_export(
  p_export_id uuid,p_file_path text,p_expires_at timestamptz default now()+interval '7 days'
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare requester uuid;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'service_role_required'; end if;
  if p_file_path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}[.]json$'
    or p_expires_at<=now() or p_expires_at>now()+interval '8 days'
  then raise exception 'invalid_export_completion'; end if;
  update public.roots_passport_exports set status='ready',file_path=p_file_path,
    completed_at=now(),expires_at=p_expires_at,error_code=null,updated_at=now()
  where id=p_export_id and status='processing' returning requested_by_profile_id into requester;
  if requester is null then raise exception 'export_not_processing'; end if;
  perform kinavela_private.enqueue_notification(requester,'passport_export_ready',
    'roots_passport_export',p_export_id,jsonb_build_object('export_id',p_export_id));
  insert into public.audit_events(event_type,entity_type,entity_id)
    values('roots_export_ready','roots_passport_export',p_export_id);
  return true;
end;
$$;

create or replace function public.fail_roots_passport_export(p_export_id uuid,p_error_code text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'service_role_required'; end if;
  update public.roots_passport_exports set status='failed',
    error_code=left(coalesce(p_error_code,'export_failed'),80),updated_at=now()
  where id=p_export_id and status='processing';
  return found;
end;
$$;

create or replace function public.retry_roots_passport_export(p_export_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.roots_passport_exports export set status='queued',error_code=null,
    requested_at=now(),completed_at=null,expires_at=null,file_path=null,updated_at=now()
  where export.id=p_export_id and export.status='failed' and export.attempts<3
    and kinavela_private.can_manage_roots_passport(export.passport_id);
  if not found then raise exception 'export_not_retryable'; end if;
  return true;
end;
$$;

create or replace function public.get_my_roots_passport_export_path(p_export_id uuid)
returns table(file_path text,expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  return query select export.file_path,export.expires_at
  from public.roots_passport_exports export
  where export.id=p_export_id and export.status='ready' and export.expires_at>now()
    and kinavela_private.can_manage_roots_passport(export.passport_id);
end;
$$;

create or replace function public.claim_expired_roots_export_paths()
returns table(path text) language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'service_role_required'; end if;
  return query with expired as (
    update public.roots_passport_exports export set status='expired',updated_at=now()
    where export.status='ready' and export.expires_at<=now()
    returning export.file_path
  ) select expired.file_path from expired where expired.file_path is not null;
end;
$$;

drop function public.list_roots_passport_exports(uuid);
create function public.list_roots_passport_exports(p_child_id uuid)
returns table(export_id uuid,status text,requested_at timestamptz,completed_at timestamptz,
  expires_at timestamptz,attempts smallint,error_code text)
language plpgsql stable security definer set search_path = '' as $$
declare passport_uuid uuid;
begin
  select id into passport_uuid from public.roots_passports where child_id=p_child_id;
  if passport_uuid is null or not kinavela_private.can_manage_roots_passport(passport_uuid)
  then raise exception 'not_authorized'; end if;
  return query select export.id,export.status,export.requested_at,export.completed_at,
    export.expires_at,export.attempts,export.error_code
  from public.roots_passport_exports export where export.passport_id=passport_uuid
  order by export.requested_at desc limit 10;
end;
$$;

create or replace function public.claim_account_deletion()
returns table(request_id uuid,profile_id uuid,auth_user_id uuid,media_paths jsonb)
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'service_role_required'; end if;
  return query with picked as (
    select request.id from public.account_deletion_requests request
    where request.status='pending' order by request.requested_at
    for update skip locked limit 1
  ), claimed as (
    update public.account_deletion_requests request set status='processing',updated_at=now()
    where request.id in(select id from picked) returning request.id,request.profile_id
  ), paths as (
    select claimed.id,claimed.profile_id,profile.auth_user_id,
      coalesce((select jsonb_agg(jsonb_build_object('bucket','roots-media','path',entry.media_path))
        from public.roots_passport_entries entry
        join public.roots_passports passport on passport.id=entry.passport_id
        join public.children child on child.id=passport.child_id
        join public.family_members member on member.family_id=child.family_id
        where member.profile_id=claimed.profile_id and entry.media_path is not null),'[]'::jsonb)
      || coalesce((select jsonb_agg(jsonb_build_object('bucket','roots-exports','path',export.file_path))
        from public.roots_passport_exports export
        join public.roots_passports passport on passport.id=export.passport_id
        join public.children child on child.id=passport.child_id
        join public.family_members member on member.family_id=child.family_id
        where member.profile_id=claimed.profile_id and export.file_path is not null),'[]'::jsonb)
      || coalesce((select jsonb_agg(jsonb_build_object('bucket','story-audio','path',story.original_audio_path))
        from public.family_stories story join public.family_members member on member.family_id=story.family_id
        where member.profile_id=claimed.profile_id and story.original_audio_path is not null),'[]'::jsonb)
      || coalesce((select jsonb_agg(jsonb_build_object('bucket','privacy-exports','path',export.file_path))
        from public.personal_data_exports export where export.profile_id=claimed.profile_id
          and export.file_path is not null),'[]'::jsonb) as media_paths
    from claimed join public.profiles profile on profile.id=claimed.profile_id
  ) select paths.id,paths.profile_id,paths.auth_user_id,paths.media_paths from paths;
end;
$$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('roots-exports','roots-exports',false,5000000,array['application/json'])
on conflict(id) do update set public=false,file_size_limit=5000000,
  allowed_mime_types=excluded.allowed_mime_types;

alter table public.notification_events drop constraint notification_events_notification_kind_check;
alter table public.notification_events add constraint notification_events_notification_kind_check
check(notification_kind in ('connection_request','connection_accepted','message_received',
  'event_reminder','village_activity','story_ready','compatible_family_available',
  'passport_export_ready'));
alter table public.notification_outbox drop constraint notification_outbox_notification_kind_check;
alter table public.notification_outbox add constraint notification_outbox_notification_kind_check
check(notification_kind in ('connection_request','connection_accepted','message_received',
  'event_reminder','village_activity','story_ready','compatible_family_available',
  'passport_export_ready'));

create or replace function kinavela_private.enqueue_notification(
  p_recipient_profile_id uuid,p_kind text,p_entity_type text,p_entity_id uuid,
  p_payload jsonb default '{}'::jsonb,p_scheduled_at timestamptz default now()
)
returns void language plpgsql security definer set search_path = '' as $$
declare preferences public.notification_preferences%rowtype;
begin
  if p_kind not in ('connection_request','connection_accepted','message_received',
    'event_reminder','village_activity','story_ready','compatible_family_available',
    'passport_export_ready') then raise exception 'invalid_notification_kind'; end if;
  select * into preferences from public.notification_preferences where profile_id=p_recipient_profile_id;
  insert into public.notification_outbox(recipient_profile_id,channel,notification_kind,
    entity_type,entity_id,payload,scheduled_at)
  values(p_recipient_profile_id,'in_app',p_kind,p_entity_type,p_entity_id,
    coalesce(p_payload,'{}'::jsonb),coalesce(p_scheduled_at,now())) on conflict do nothing;
  if coalesce(preferences.email_enabled,false) and exists(select 1 from public.consents
    where profile_id=p_recipient_profile_id and consent_type='product_email' and revoked_at is null)
  then insert into public.notification_outbox(recipient_profile_id,channel,notification_kind,
    entity_type,entity_id,payload,scheduled_at)
    values(p_recipient_profile_id,'email',p_kind,p_entity_type,p_entity_id,
      coalesce(p_payload,'{}'::jsonb),coalesce(p_scheduled_at,now())) on conflict do nothing; end if;
  if coalesce(preferences.push_enabled,false) and exists(select 1 from public.notification_push_subscriptions
    where profile_id=p_recipient_profile_id)
  then insert into public.notification_outbox(recipient_profile_id,channel,notification_kind,
    entity_type,entity_id,payload,scheduled_at)
    values(p_recipient_profile_id,'push',p_kind,p_entity_type,p_entity_id,
      coalesce(p_payload,'{}'::jsonb),coalesce(p_scheduled_at,now())) on conflict do nothing; end if;
end;
$$;

revoke all on function public.list_roots_passport_entries_v2(uuid),
  public.get_roots_passport_options(uuid),public.update_roots_passport_entry(uuid,jsonb),
  public.list_roots_entry_sharing_history(uuid),public.get_roots_media_path(uuid),
  public.replace_roots_media(uuid,text,text,text,bigint),public.detach_roots_media(uuid),
  public.delete_roots_passport_entry_v2(uuid),public.claim_roots_passport_export(),
  public.get_roots_passport_export_payload(uuid),
  public.complete_roots_passport_export(uuid,text,timestamptz),
  public.fail_roots_passport_export(uuid,text),public.retry_roots_passport_export(uuid),
  public.get_my_roots_passport_export_path(uuid),public.claim_expired_roots_export_paths(),
  public.list_roots_passport_exports(uuid)
from public,anon,authenticated,service_role;
grant execute on function public.list_roots_passport_entries_v2(uuid),
  public.get_roots_passport_options(uuid),public.update_roots_passport_entry(uuid,jsonb),
  public.list_roots_entry_sharing_history(uuid),public.get_roots_media_path(uuid),
  public.replace_roots_media(uuid,text,text,text,bigint),public.detach_roots_media(uuid),
  public.delete_roots_passport_entry_v2(uuid),public.retry_roots_passport_export(uuid),
  public.get_my_roots_passport_export_path(uuid),
  public.list_roots_passport_exports(uuid) to authenticated;
grant execute on function public.claim_roots_passport_export(),
  public.get_roots_passport_export_payload(uuid),
  public.complete_roots_passport_export(uuid,text,timestamptz),
  public.fail_roots_passport_export(uuid,text),public.claim_expired_roots_export_paths()
to service_role;

insert into kinavela_private.schema_migrations(version)
values('202608130017_complete_roots_passport') on conflict(version) do nothing;
notify pgrst,'reload schema';
commit;
