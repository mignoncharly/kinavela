begin;

create table public.roots_passports (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null unique references public.children(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.roots_passport_entries (
  id uuid primary key default gen_random_uuid(),
  passport_id uuid not null references public.roots_passports(id) on delete cascade,
  type text not null check (type in (
    'language', 'story', 'recipe', 'place', 'tradition', 'event',
    'family_memory', 'achievement', 'trip', 'photo', 'audio', 'video', 'document'
  )),
  title text not null check (char_length(btrim(title)) between 2 and 160),
  description text check (description is null or char_length(description) <= 5000),
  culture_id uuid references public.cultures(id) on delete restrict,
  language_id uuid references public.languages(id) on delete restrict,
  event_id uuid references public.events(id) on delete set null,
  mission_id uuid references public.cultural_missions(id) on delete set null,
  village_id uuid references public.villages(id) on delete set null,
  occurred_at timestamptz not null default now(),
  visibility text not null default 'private' check (visibility in ('private', 'family', 'village')),
  media_kind text check (media_kind is null or media_kind in ('photo', 'audio', 'video', 'document')),
  media_path text check (media_path is null or char_length(media_path) between 10 and 500),
  media_mime_type text check (media_mime_type is null or char_length(media_mime_type) between 3 and 120),
  media_size_bytes bigint check (media_size_bytes is null or media_size_bytes between 1 and 25000000),
  created_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((media_path is null and media_kind is null and media_mime_type is null and media_size_bytes is null)
    or (media_path is not null and media_kind is not null and media_mime_type is not null and media_size_bytes is not null)),
  check ((visibility = 'village' and village_id is not null) or visibility <> 'village')
);

create table public.roots_passport_exports (
  id uuid primary key default gen_random_uuid(),
  passport_id uuid not null references public.roots_passports(id) on delete cascade,
  requested_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'queued' check (status in ('queued', 'processing', 'ready', 'failed', 'expired')),
  file_path text check (file_path is null or char_length(file_path) between 5 and 500),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  expires_at timestamptz,
  check ((status = 'ready' and file_path is not null and completed_at is not null)
    or status <> 'ready')
);

create unique index roots_passport_active_export_unique
  on public.roots_passport_exports(passport_id)
  where status in ('queued', 'processing');
create index roots_passport_entries_timeline_idx
  on public.roots_passport_entries(passport_id, occurred_at desc, created_at desc);
create index roots_passport_entries_mission_idx
  on public.roots_passport_entries(mission_id)
  where mission_id is not null;
create index roots_passport_entries_event_idx
  on public.roots_passport_entries(event_id)
  where event_id is not null;
create index roots_passport_exports_requester_idx
  on public.roots_passport_exports(requested_by_profile_id, requested_at desc);

create trigger roots_passports_set_updated_at
  before update on public.roots_passports
  for each row execute function public.set_updated_at();
create trigger roots_passport_entries_set_updated_at
  before update on public.roots_passport_entries
  for each row execute function public.set_updated_at();

alter table public.roots_passports enable row level security;
alter table public.roots_passports force row level security;
alter table public.roots_passport_entries enable row level security;
alter table public.roots_passport_entries force row level security;
alter table public.roots_passport_exports enable row level security;
alter table public.roots_passport_exports force row level security;

revoke all on public.roots_passports, public.roots_passport_entries, public.roots_passport_exports
  from public, anon, authenticated;

create or replace function kinavela_private.can_manage_roots_passport(p_passport_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.roots_passports passport
    join public.children child on child.id = passport.child_id
    join public.family_members member on member.family_id = child.family_id
    where passport.id = p_passport_id
      and member.profile_id = public.current_profile_id()
      and member.status = 'active'
      and member.role in ('owner', 'guardian')
  );
$$;

create or replace function kinavela_private.can_view_roots_entry(p_entry_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.roots_passport_entries entry
    join public.roots_passports passport on passport.id = entry.passport_id
    join public.children child on child.id = passport.child_id
    join public.family_members member on member.family_id = child.family_id
    where entry.id = p_entry_id
      and (
        (member.profile_id = public.current_profile_id() and member.status = 'active'
          and member.role in ('owner', 'guardian'))
        or (entry.visibility = 'family' and member.profile_id = public.current_profile_id()
          and member.status = 'active')
        or (entry.visibility = 'village' and entry.village_id is not null
          and public.can_access_village(entry.village_id))
      )
  );
$$;

create or replace function public.can_manage_roots_passport(p_passport_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select kinavela_private.can_manage_roots_passport(p_passport_id) $$;

revoke all on function kinavela_private.can_manage_roots_passport(uuid),
  kinavela_private.can_view_roots_entry(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.can_manage_roots_passport(uuid)
  from public, anon, service_role;
grant execute on function public.can_manage_roots_passport(uuid) to authenticated;

create or replace function kinavela_private.create_roots_passport_for_child()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.roots_passports(child_id)
  values (new.id)
  on conflict (child_id) do nothing;
  return new;
end;
$$;

drop trigger if exists children_create_roots_passport on public.children;
create trigger children_create_roots_passport
  after insert on public.children
  for each row execute function kinavela_private.create_roots_passport_for_child();

insert into public.roots_passports(child_id)
select child.id
from public.children child
on conflict (child_id) do nothing;

create or replace function public.list_my_roots_passports()
returns table (
  passport_id uuid,
  child_id uuid,
  child_nickname text,
  entry_count integer,
  last_occurred_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.current_profile_id() is null then raise exception 'not_authenticated'; end if;
  return query
  select passport.id, child.id, child.nickname,
    (select count(*)::integer from public.roots_passport_entries entry where entry.passport_id = passport.id),
    (select max(entry.occurred_at) from public.roots_passport_entries entry where entry.passport_id = passport.id)
  from public.roots_passports passport
  join public.children child on child.id = passport.child_id
  where kinavela_private.can_manage_roots_passport(passport.id)
  order by child.nickname, child.id;
end;
$$;

create or replace function public.list_roots_passport_entries(p_child_id uuid)
returns table (
  entry_id uuid,
  passport_id uuid,
  child_id uuid,
  type text,
  title text,
  description text,
  culture_name text,
  language_name text,
  event_id uuid,
  mission_id uuid,
  village_id uuid,
  occurred_at timestamptz,
  visibility text,
  media_kind text,
  media_available boolean,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  passport_uuid uuid;
begin
  if public.current_profile_id() is null then raise exception 'not_authenticated'; end if;
  select passport.id into passport_uuid
  from public.roots_passports passport
  where passport.child_id = p_child_id;
  if passport_uuid is null then raise exception 'passport_not_found'; end if;
  if not kinavela_private.can_manage_roots_passport(passport_uuid) then
    raise exception 'not_authorized';
  end if;
  return query
  select entry.id, entry.passport_id, p_child_id, entry.type, entry.title, entry.description,
    culture.name, language.name, entry.event_id, entry.mission_id, entry.village_id,
    entry.occurred_at, entry.visibility, entry.media_kind, entry.media_path is not null,
    entry.created_at
  from public.roots_passport_entries entry
  left join public.cultures culture on culture.id = entry.culture_id
  left join public.languages language on language.id = entry.language_id
  where entry.passport_id = passport_uuid
  order by entry.occurred_at desc, entry.created_at desc, entry.id;
end;
$$;

create or replace function public.create_roots_passport_entry(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_uuid uuid := public.current_profile_id();
  child_uuid uuid := nullif(p_payload ->> 'child_id', '')::uuid;
  passport_uuid uuid;
  entry_uuid uuid := gen_random_uuid();
  family_uuid uuid;
  event_village_id uuid;
  clean_title text := btrim(coalesce(p_payload ->> 'title', ''));
  clean_description text := nullif(btrim(coalesce(p_payload ->> 'description', '')), '');
  entry_type text := p_payload ->> 'type';
  entry_visibility text := coalesce(p_payload ->> 'visibility', 'private');
  media_path_value text := nullif(btrim(coalesce(p_payload ->> 'media_path', '')), '');
  culture_uuid uuid := nullif(p_payload ->> 'culture_id', '')::uuid;
  language_uuid uuid := nullif(p_payload ->> 'language_id', '')::uuid;
  event_uuid uuid := nullif(p_payload ->> 'event_id', '')::uuid;
  mission_uuid uuid := nullif(p_payload ->> 'mission_id', '')::uuid;
  village_uuid uuid := nullif(p_payload ->> 'village_id', '')::uuid;
  occurred_value timestamptz := coalesce(nullif(p_payload ->> 'occurred_at', '')::timestamptz, now());
  media_size bigint := nullif(p_payload ->> 'media_size_bytes', '')::bigint;
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  if child_uuid is null then raise exception 'child_required'; end if;
  if clean_title is null or char_length(clean_title) not between 2 and 160 then raise exception 'invalid_entry_title'; end if;
  if clean_description is not null and char_length(clean_description) > 5000 then raise exception 'invalid_entry_description'; end if;
  if entry_type not in ('language', 'story', 'recipe', 'place', 'tradition', 'event', 'family_memory', 'achievement', 'trip', 'photo', 'audio', 'video', 'document') then raise exception 'invalid_entry_type'; end if;
  if entry_visibility not in ('private', 'family', 'village') then raise exception 'invalid_entry_visibility'; end if;

  select child.family_id, passport.id into family_uuid, passport_uuid
  from public.children child
  join public.roots_passports passport on passport.child_id = child.id
  where child.id = child_uuid;
  if passport_uuid is null or not kinavela_private.can_manage_roots_passport(passport_uuid) then raise exception 'not_authorized'; end if;
  if culture_uuid is not null and not exists (select 1 from public.cultures where id = culture_uuid) then raise exception 'culture_not_found'; end if;
  if language_uuid is not null and not exists (select 1 from public.languages where id = language_uuid) then raise exception 'language_not_found'; end if;
  if event_uuid is not null then
    select event.village_id into event_village_id from public.events event where event.id = event_uuid;
    if event_village_id is null or not public.can_access_village(event_village_id) then raise exception 'event_not_available'; end if;
  end if;
  if mission_uuid is not null and not exists (
    select 1 from public.family_mission_progress progress
    where progress.family_id = family_uuid and progress.mission_id = mission_uuid and progress.status = 'completed'
  ) then raise exception 'mission_not_completed'; end if;
  if entry_visibility = 'village' then
    if village_uuid is null or not public.can_access_village(village_uuid) then raise exception 'village_not_available'; end if;
  end if;
  if media_path_value is not null and (split_part(media_path_value, '/', 1) <> passport_uuid::text or split_part(media_path_value, '/', 2) <> entry_uuid::text) then
    raise exception 'invalid_media_path';
  end if;
  if occurred_value > now() + interval '1 day' then raise exception 'invalid_occurred_at'; end if;

  insert into public.roots_passport_entries(
    id, passport_id, type, title, description, culture_id, language_id, event_id,
    mission_id, village_id, occurred_at, visibility, media_kind, media_path,
    media_mime_type, media_size_bytes, created_by_profile_id
  ) values (
    entry_uuid, passport_uuid, entry_type, clean_title, clean_description, culture_uuid, language_uuid,
    event_uuid, mission_uuid, village_uuid, occurred_value, entry_visibility,
    nullif(p_payload ->> 'media_kind', ''), media_path_value, nullif(p_payload ->> 'media_mime_type', ''),
    media_size, profile_uuid
  );
  insert into public.audit_events(actor_profile_id, event_type, entity_type, entity_id, metadata)
  values (profile_uuid, 'roots_entry_created', 'roots_passport_entry', entry_uuid,
    jsonb_build_object('passport_id', passport_uuid, 'child_id', child_uuid, 'type', entry_type,
      'mission_id', mission_uuid, 'event_id', event_uuid));
  return entry_uuid;
end;
$$;

create or replace function public.create_roots_entry_from_mission(
  p_child_id uuid,
  p_mission_id uuid,
  p_title text,
  p_description text,
  p_occurred_at timestamptz default now(),
  p_visibility text default 'private'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  family_uuid uuid;
begin
  select child.family_id into family_uuid from public.children child where child.id = p_child_id;
  if family_uuid is null or not kinavela_private.can_manage_roots_passport((select id from public.roots_passports where child_id = p_child_id)) then raise exception 'not_authorized'; end if;
  if not exists (select 1 from public.family_mission_progress progress where progress.family_id = family_uuid and progress.mission_id = p_mission_id and progress.status = 'completed') then raise exception 'mission_not_completed'; end if;
  return public.create_roots_passport_entry(jsonb_build_object(
    'child_id', p_child_id, 'mission_id', p_mission_id, 'type', 'achievement',
    'title', p_title, 'description', p_description, 'occurred_at', p_occurred_at,
    'visibility', p_visibility
  ));
end;
$$;

create or replace function public.delete_roots_passport_entry(p_entry_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare profile_uuid uuid := public.current_profile_id(); entry_row public.roots_passport_entries%rowtype;
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  select * into entry_row from public.roots_passport_entries where id = p_entry_id for update;
  if entry_row.id is null or not kinavela_private.can_manage_roots_passport(entry_row.passport_id) then raise exception 'not_authorized'; end if;
  delete from public.roots_passport_entries where id = p_entry_id;
  insert into public.audit_events(actor_profile_id, event_type, entity_type, entity_id)
  values (profile_uuid, 'roots_entry_deleted', 'roots_passport_entry', p_entry_id);
  return true;
end;
$$;

create or replace function public.request_roots_passport_export(p_child_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare profile_uuid uuid := public.current_profile_id(); passport_uuid uuid; export_uuid uuid;
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  select id into passport_uuid from public.roots_passports where child_id = p_child_id;
  if passport_uuid is null or not kinavela_private.can_manage_roots_passport(passport_uuid) then raise exception 'not_authorized'; end if;
  insert into public.roots_passport_exports(passport_id, requested_by_profile_id)
  values (passport_uuid, profile_uuid)
  on conflict (passport_id) where status in ('queued', 'processing') do update set requested_at = now(), requested_by_profile_id = profile_uuid
  returning id into export_uuid;
  insert into public.audit_events(actor_profile_id, event_type, entity_type, entity_id)
  values (profile_uuid, 'roots_export_requested', 'roots_passport', passport_uuid);
  return export_uuid;
end;
$$;

create or replace function public.list_roots_passport_exports(p_child_id uuid)
returns table (export_id uuid, status text, requested_at timestamptz, completed_at timestamptz, expires_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare passport_uuid uuid;
begin
  select id into passport_uuid from public.roots_passports where child_id = p_child_id;
  if passport_uuid is null or not kinavela_private.can_manage_roots_passport(passport_uuid) then raise exception 'not_authorized'; end if;
  return query select export.id, export.status, export.requested_at, export.completed_at, export.expires_at
  from public.roots_passport_exports export where export.passport_id = passport_uuid order by export.requested_at desc limit 10;
end;
$$;

create or replace function public.attach_roots_media(
  p_entry_id uuid, p_media_path text, p_media_kind text, p_media_mime_type text, p_media_size_bytes bigint
)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare entry_row public.roots_passport_entries%rowtype;
begin
  select * into entry_row from public.roots_passport_entries where id = p_entry_id for update;
  if entry_row.id is null or not kinavela_private.can_manage_roots_passport(entry_row.passport_id) then raise exception 'not_authorized'; end if;
  if split_part(p_media_path, '/', 1) <> entry_row.passport_id::text or split_part(p_media_path, '/', 2) <> entry_row.id::text then raise exception 'invalid_media_path'; end if;
  if p_media_kind not in ('photo', 'audio', 'video', 'document') or p_media_size_bytes not between 1 and 25000000 then raise exception 'invalid_media'; end if;
  update public.roots_passport_entries
  set media_path = p_media_path, media_kind = p_media_kind, media_mime_type = p_media_mime_type,
    media_size_bytes = p_media_size_bytes, updated_at = now()
  where id = p_entry_id;
  return true;
end;
$$;

create or replace function kinavela_private.can_manage_roots_media_object(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
    and kinavela_private.can_manage_roots_passport(split_part(p_name, '/', 1)::uuid);
$$;

revoke all on function kinavela_private.create_roots_passport_for_child(),
  kinavela_private.can_manage_roots_media_object(text)
  from public, anon, authenticated, service_role;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('roots-media', 'roots-media', false, 25000000,
  array['image/jpeg', 'image/png', 'image/webp', 'audio/mpeg', 'audio/wav', 'audio/mp4', 'video/mp4', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 25000000,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Roots guardians manage media" on storage.objects;
create policy "Roots guardians manage media" on storage.objects
  for all to authenticated
  using (bucket_id = 'roots-media' and kinavela_private.can_manage_roots_media_object(name))
  with check (bucket_id = 'roots-media' and kinavela_private.can_manage_roots_media_object(name));

revoke all on function public.list_my_roots_passports(),
  public.list_roots_passport_entries(uuid), public.create_roots_passport_entry(jsonb),
  public.create_roots_entry_from_mission(uuid, uuid, text, text, timestamptz, text),
  public.delete_roots_passport_entry(uuid), public.request_roots_passport_export(uuid),
  public.list_roots_passport_exports(uuid), public.attach_roots_media(uuid, text, text, text, bigint)
  from public, anon, service_role;
grant execute on function public.list_my_roots_passports(),
  public.list_roots_passport_entries(uuid), public.create_roots_passport_entry(jsonb),
  public.create_roots_entry_from_mission(uuid, uuid, text, text, timestamptz, text),
  public.delete_roots_passport_entry(uuid), public.request_roots_passport_export(uuid),
  public.list_roots_passport_exports(uuid), public.attach_roots_media(uuid, text, text, text, bigint)
  to authenticated;

insert into kinavela_private.schema_migrations(version)
values ('202608110002_roots_passport')
on conflict (version) do nothing;

notify pgrst, 'reload schema';
commit;
