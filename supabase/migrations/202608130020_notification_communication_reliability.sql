begin;

alter table public.notification_preferences
  add column if not exists community_enabled boolean not null default true,
  add column if not exists events_enabled boolean not null default true,
  add column if not exists direct_enabled boolean not null default true,
  add column if not exists heritage_enabled boolean not null default true,
  add column if not exists safety_enabled boolean not null default true;

alter table public.notification_outbox
  add column if not exists claimed_at timestamptz;

alter table public.notification_events
  drop constraint notification_events_notification_kind_check;
alter table public.notification_events
  add constraint notification_events_notification_kind_check check (
    notification_kind in (
      'connection_request','connection_accepted','message_received',
      'event_reminder','village_activity','story_ready',
      'compatible_family_available','passport_export_ready',
      'referral_accepted','village_invitation','village_join_request',
      'village_join_decision','event_invitation','event_changed',
      'event_rsvp_update','playdate_proposal','support_response',
      'report_resolved','story_failed'
    )
  );

alter table public.notification_outbox
  drop constraint notification_outbox_notification_kind_check;
alter table public.notification_outbox
  add constraint notification_outbox_notification_kind_check check (
    notification_kind in (
      'connection_request','connection_accepted','message_received',
      'event_reminder','village_activity','story_ready',
      'compatible_family_available','passport_export_ready',
      'referral_accepted','village_invitation','village_join_request',
      'village_join_decision','event_invitation','event_changed',
      'event_rsvp_update','playdate_proposal','support_response',
      'report_resolved','story_failed'
    )
  );

create or replace function kinavela_private.notification_payload_is_safe(p_payload jsonb)
returns boolean
language sql
immutable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_typeof(p_payload) = 'object', false)
    and pg_column_size(p_payload) <= 4000
    and not (p_payload ?| array[
      'message_body','body','exact_address','address','child_name',
      'child_nickname','transcript','transcript_original',
      'transcript_translation','adapted_story','audio_path'
    ])
$$;

revoke all on function kinavela_private.notification_payload_is_safe(jsonb)
from public, anon, authenticated, service_role;

create or replace function kinavela_private.enqueue_notification(
  p_recipient_profile_id uuid, p_kind text, p_entity_type text, p_entity_id uuid,
  p_payload jsonb default '{}'::jsonb, p_scheduled_at timestamptz default now()
)
returns void language plpgsql security definer set search_path = '' as $$ 
declare
  preferences public.notification_preferences%rowtype;
  normalized_kind text := p_kind;
  safe_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  category_enabled boolean := true;
begin
  if p_kind = 'village_activity' and p_entity_type = 'village_support_reply' then
    normalized_kind := 'support_response';
  end if;
  if normalized_kind not in (
    'connection_request','connection_accepted','message_received',
    'event_reminder','village_activity','story_ready',
    'compatible_family_available','passport_export_ready',
    'referral_accepted','village_invitation','village_join_request',
    'village_join_decision','event_invitation','event_changed',
    'event_rsvp_update','playdate_proposal','support_response',
    'report_resolved','story_failed'
  ) then raise exception 'invalid_notification_kind'; end if;
  if p_recipient_profile_id is null or p_entity_id is null
     or p_entity_type !~ '^[a-z][a-z0-9_]{1,40}$' then
    raise exception 'invalid_notification_target';
  end if;
  if not kinavela_private.notification_payload_is_safe(safe_payload) then
    raise exception 'unsafe_notification_payload';
  end if;

  select * into preferences from public.notification_preferences
  where profile_id = p_recipient_profile_id;
  category_enabled := case
    when normalized_kind in (
      'connection_request','connection_accepted','village_activity',
      'compatible_family_available','referral_accepted','village_invitation',
      'village_join_request','village_join_decision','support_response'
    ) then coalesce(preferences.community_enabled, true)
    when normalized_kind in (
      'event_reminder','event_invitation','event_changed','event_rsvp_update'
    ) then coalesce(preferences.events_enabled, true)
    when normalized_kind in ('message_received','playdate_proposal')
      then coalesce(preferences.direct_enabled, true)
    when normalized_kind in (
      'story_ready','story_failed','passport_export_ready'
    ) then coalesce(preferences.heritage_enabled, true)
    when normalized_kind = 'report_resolved'
      then coalesce(preferences.safety_enabled, true)
    else true
  end;
  if not category_enabled then return; end if;

  insert into public.notification_outbox(
    recipient_profile_id,channel,notification_kind,entity_type,
    entity_id,payload,scheduled_at
  ) values (
    p_recipient_profile_id,'in_app',normalized_kind,p_entity_type,
    p_entity_id,safe_payload,coalesce(p_scheduled_at,now())
  ) on conflict do nothing;
  if coalesce(preferences.email_enabled,false) and exists (
    select 1 from public.consents consent
    where consent.profile_id=p_recipient_profile_id
      and consent.consent_type='product_email' and consent.revoked_at is null
  ) then
    insert into public.notification_outbox(
      recipient_profile_id,channel,notification_kind,entity_type,
      entity_id,payload,scheduled_at
    ) values (
      p_recipient_profile_id,'email',normalized_kind,p_entity_type,
      p_entity_id,safe_payload,coalesce(p_scheduled_at,now())
    ) on conflict do nothing;
  end if;
  if coalesce(preferences.push_enabled,false) and exists (
    select 1 from public.notification_push_subscriptions subscription
    where subscription.profile_id=p_recipient_profile_id
  ) then
    insert into public.notification_outbox(
      recipient_profile_id,channel,notification_kind,entity_type,
      entity_id,payload,scheduled_at
    ) values (
      p_recipient_profile_id,'push',normalized_kind,p_entity_type,
      p_entity_id,safe_payload,coalesce(p_scheduled_at,now())
    ) on conflict do nothing;
  end if;
end;
$$;

drop function if exists public.get_notification_preferences();
create function public.get_notification_preferences()
returns table (
  email_enabled boolean, push_enabled boolean, push_subscription_count integer,
  community_enabled boolean, events_enabled boolean, direct_enabled boolean,
  heritage_enabled boolean, safety_enabled boolean
)
language sql stable security definer set search_path = '' as $$ 
  select coalesce(preferences.email_enabled,false),
    coalesce(preferences.push_enabled,false),
    (select count(*)::integer from public.notification_push_subscriptions subscription
      where subscription.profile_id=public.current_profile_id()),
    coalesce(preferences.community_enabled,true),
    coalesce(preferences.events_enabled,true),
    coalesce(preferences.direct_enabled,true),
    coalesce(preferences.heritage_enabled,true),
    coalesce(preferences.safety_enabled,true)
  from (select public.current_profile_id() as profile_id) current
  left join public.notification_preferences preferences
    on preferences.profile_id=current.profile_id
$$;

create or replace function public.update_notification_preferences_v2(
  p_email_enabled boolean, p_push_enabled boolean,
  p_community_enabled boolean, p_events_enabled boolean,
  p_direct_enabled boolean, p_heritage_enabled boolean,
  p_safety_enabled boolean
)
returns boolean language plpgsql security definer set search_path = '' as $$ 
declare profile_uuid uuid := public.current_profile_id();
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  if p_push_enabled and not exists (
    select 1 from public.notification_push_subscriptions
    where profile_id=profile_uuid
  ) then raise exception 'push_subscription_required'; end if;
  insert into public.notification_preferences(
    profile_id,email_enabled,push_enabled,community_enabled,events_enabled,
    direct_enabled,heritage_enabled,safety_enabled
  ) values (
    profile_uuid,p_email_enabled,p_push_enabled,p_community_enabled,
    p_events_enabled,p_direct_enabled,p_heritage_enabled,p_safety_enabled
  ) on conflict(profile_id) do update set
    email_enabled=excluded.email_enabled,
    push_enabled=excluded.push_enabled,
    community_enabled=excluded.community_enabled,
    events_enabled=excluded.events_enabled,
    direct_enabled=excluded.direct_enabled,
    heritage_enabled=excluded.heritage_enabled,
    safety_enabled=excluded.safety_enabled,
    updated_at=now();
  if p_email_enabled then
    insert into public.consents(profile_id,consent_type,policy_version)
    values(profile_uuid,'product_email','notifications-v1')
    on conflict do nothing;
  else
    update public.consents set revoked_at=coalesce(revoked_at,now())
    where profile_id=profile_uuid and consent_type='product_email'
      and revoked_at is null;
  end if;
  return true;
end;
$$;

create or replace function public.claim_notification_deliveries()
returns table (
  delivery_id uuid, recipient_profile_id uuid, channel text,
  notification_kind text, recipient_email text, locale text,
  channel_enabled boolean, payload jsonb
)
language plpgsql security definer set search_path = '' as $$ 
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'service_role_required'; end if;
  update public.notification_outbox set
    status=case when attempts>=5 then 'failed' else 'queued' end,
    error_code=case when attempts>=5 then 'delivery_retries_exhausted' else error_code end,
    claimed_at=null,
    scheduled_at=case when attempts>=5 then scheduled_at else now() end
  where status='processing' and claimed_at < now()-interval '15 minutes';
  return query
  with picked as (
    select outbox.id from public.notification_outbox outbox
    where outbox.status='queued' and outbox.scheduled_at<=now()
      and outbox.attempts<5
    order by outbox.scheduled_at,outbox.created_at
    for update skip locked limit 50
  ), claimed as (
    update public.notification_outbox outbox set status='processing',
      attempts=attempts+1,claimed_at=now()
    where outbox.id in(select id from picked) returning outbox.*
  )
  select claimed.id,claimed.recipient_profile_id,claimed.channel,
    claimed.notification_kind,auth_user.email::text,
    profile.preferred_language::text,
    case claimed.channel
      when 'email' then kinavela_private.feature_enabled(
        'notifications_email',claimed.recipient_profile_id)
      when 'push' then kinavela_private.feature_enabled(
        'web_push_delivery',claimed.recipient_profile_id)
      else true end,
    claimed.payload
  from claimed join public.profiles profile
    on profile.id=claimed.recipient_profile_id
  join auth.users auth_user on auth_user.id=profile.auth_user_id;
end;
$$;

create or replace function public.complete_notification_delivery(
  p_delivery_id uuid,p_status text,p_error_code text default null
)
returns boolean language plpgsql security definer set search_path = '' as $$ 
declare delivery public.notification_outbox%rowtype;
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'service_role_required'; end if;
  if p_status not in ('sent','failed','suppressed') then raise exception 'invalid_delivery_status'; end if;
  select * into delivery from public.notification_outbox where id=p_delivery_id for update;
  if delivery.id is null then raise exception 'delivery_not_found'; end if;
  if p_status='failed' and delivery.attempts<5 then
    update public.notification_outbox set status='queued',
      error_code=left(coalesce(nullif(p_error_code,''),'notification_delivery_failed'),80),
      scheduled_at=now()+make_interval(secs=>least(900,30*power(2,greatest(delivery.attempts-1,0)))::integer),
      claimed_at=null where id=p_delivery_id;
    return true;
  end if;
  update public.notification_outbox set status=p_status,
    error_code=left(nullif(p_error_code,''),80),claimed_at=null,
    delivered_at=case when p_status='sent' then now() else delivered_at end
  where id=p_delivery_id;
  if p_status='sent' and delivery.channel='in_app' then
    insert into public.notification_events(
      recipient_profile_id,notification_kind,entity_type,entity_id,payload
    ) values (
      delivery.recipient_profile_id,delivery.notification_kind,
      delivery.entity_type,delivery.entity_id,delivery.payload
    ) on conflict(recipient_profile_id,notification_kind,entity_id) do nothing;
  end if;
  return true;
end;
$$;

create or replace function kinavela_private.notify_invitation_claim()
returns trigger language plpgsql security definer set search_path = '' as $$ 
declare link_row public.invitation_links%rowtype;
begin
  select * into link_row from public.invitation_links where id=new.invitation_link_id;
  if new.outcome='referral_onboarded' then
    perform kinavela_private.enqueue_notification(
      link_row.created_by_profile_id,'referral_accepted','invitation_claim',new.id,
      jsonb_build_object('invitation_id',link_row.id)
    );
  elsif new.outcome='village_joined' then
    delete from public.notification_outbox outbox
    using public.village_members member
    where member.village_id=link_row.village_id
      and member.family_id=new.claimed_by_family_id
      and outbox.recipient_profile_id=new.claimed_by_profile_id
      and outbox.notification_kind='village_invitation'
      and outbox.entity_id=member.id and outbox.status='queued';
  end if;
  return new;
end;
$$;

create or replace function kinavela_private.notify_village_membership()
returns trigger language plpgsql security definer set search_path = '' as $$ 
declare recipient record; signal_uuid uuid := gen_random_uuid();
begin
  if tg_op='INSERT' and new.status='invited' then
    for recipient in select member.profile_id from public.family_members member
      where member.family_id=new.family_id and member.status='active'
        and member.role in('owner','guardian')
    loop
      perform kinavela_private.enqueue_notification(
        recipient.profile_id,'village_invitation','village_membership',new.id,
        jsonb_build_object('village_id',new.village_id)
      );
    end loop;
  elsif tg_op='INSERT' and new.status='requested' then
    for recipient in
      select distinct family_member.profile_id
      from public.village_members manager
      join public.family_members family_member on family_member.family_id=manager.family_id
      where manager.village_id=new.village_id and manager.status='active'
        and manager.role in('owner','moderator')
        and family_member.status='active' and family_member.role in('owner','guardian')
    loop
      perform kinavela_private.enqueue_notification(
        recipient.profile_id,'village_join_request','village_membership',new.id,
        jsonb_build_object('village_id',new.village_id)
      );
    end loop;
  elsif tg_op='UPDATE' and old.status='requested'
    and new.status in('active','declined','removed') then
    for recipient in select member.profile_id from public.family_members member
      where member.family_id=new.family_id and member.status='active'
        and member.role in('owner','guardian')
    loop
      perform kinavela_private.enqueue_notification(
        recipient.profile_id,'village_join_decision','village_membership_decision',
        signal_uuid,jsonb_build_object('village_id',new.village_id,'accepted',new.status='active')
      );
    end loop;
  end if;
  return new;
end;
$$;

create or replace function kinavela_private.notify_event_invitation()
returns trigger language plpgsql security definer set search_path = '' as $$ 
declare recipient record;
begin
  if coalesce(new.recurrence_index,0)<>0 then return new; end if;
  for recipient in
    select distinct family_member.profile_id
    from public.village_members membership
    join public.family_members family_member on family_member.family_id=membership.family_id
    where membership.village_id=new.village_id and membership.status='active'
      and family_member.status='active' and family_member.profile_id<>new.creator_profile_id
  loop
    perform kinavela_private.enqueue_notification(
      recipient.profile_id,'event_invitation','village_event',new.id,
      jsonb_build_object('village_id',new.village_id,'event_id',new.id)
    );
  end loop;
  return new;
end;
$$;

create or replace function kinavela_private.notify_event_rsvp()
returns trigger language plpgsql security definer set search_path = '' as $$ 
declare event_row public.events%rowtype; recipient record; signal_uuid uuid:=gen_random_uuid();
begin
  if tg_op='UPDATE' and old.status=new.status then return new; end if;
  select * into event_row from public.events where id=new.event_id;
  if event_row.creator_family_id<>new.family_id then
    perform kinavela_private.enqueue_notification(
      event_row.creator_profile_id,'event_rsvp_update','event_rsvp',signal_uuid,
      jsonb_build_object('village_id',event_row.village_id,'event_id',new.event_id)
    );
  end if;
  if tg_op='UPDATE' and old.status='waitlisted' and new.status='going' then
    for recipient in select member.profile_id from public.family_members member
      where member.family_id=new.family_id and member.status='active'
        and member.role in('owner','guardian')
    loop
      perform kinavela_private.enqueue_notification(
        recipient.profile_id,'event_rsvp_update','waitlist_promotion',signal_uuid,
        jsonb_build_object('village_id',event_row.village_id,'event_id',new.event_id,'promoted',true)
      );
    end loop;
  end if;
  return new;
end;
$$;

create or replace function kinavela_private.notify_event_reminder()
returns trigger language plpgsql security definer set search_path = '' as $$ 
declare event_row public.events%rowtype; kind_value text;
begin
  select * into event_row from public.events where id=new.event_id;
  kind_value:=case
    when new.reminder_kind in('event_updated','event_cancelled') then 'event_changed'
    when new.reminder_kind='waitlist_promoted' then 'event_rsvp_update'
    else 'event_reminder' end;
  perform kinavela_private.enqueue_notification(
    new.recipient_profile_id,kind_value,'event_reminder',new.id,
    jsonb_build_object('village_id',event_row.village_id,'event_id',new.event_id,
      'reminder_kind',new.reminder_kind),new.due_at
  );
  return new;
end;
$$;

create or replace function kinavela_private.notify_playdate_proposal()
returns trigger language plpgsql security definer set search_path = '' as $$ 
declare recipient record;
begin
  for recipient in select member.profile_id from public.family_members member
    where member.family_id=new.recipient_family_id and member.status='active'
      and member.role in('owner','guardian')
  loop
    perform kinavela_private.enqueue_notification(
      recipient.profile_id,'playdate_proposal','playdate',new.id,
      jsonb_build_object('connection_id',new.connection_id)
    );
  end loop;
  return new;
end;
$$;

create or replace function kinavela_private.notify_report_resolution()
returns trigger language plpgsql security definer set search_path = '' as $$ 
begin
  if old.status is distinct from new.status and new.status in('resolved','dismissed') then
    perform kinavela_private.enqueue_notification(
      new.reporter_profile_id,'report_resolved','report',new.id,
      jsonb_build_object('resolution',new.status)
    );
  end if;
  return new;
end;
$$;

create or replace function kinavela_private.notify_story_ready()
returns trigger language plpgsql security definer set search_path = '' as $$ 
declare member record; kind_value text;
begin
  if old.ai_status is not distinct from new.ai_status
     or new.ai_status not in('ready','failed') then return new; end if;
  kind_value:=case when new.ai_status='ready' then 'story_ready' else 'story_failed' end;
  for member in select family_member.profile_id from public.family_members family_member
    where family_member.family_id=new.family_id and family_member.status='active'
      and family_member.role in('owner','guardian')
  loop
    perform kinavela_private.enqueue_notification(
      member.profile_id,kind_value,'family_story',new.id,'{}'::jsonb
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists invitation_claims_notify_creator on public.invitation_claims;
create trigger invitation_claims_notify_creator after insert on public.invitation_claims
for each row execute function kinavela_private.notify_invitation_claim();
drop trigger if exists village_members_notify_activity on public.village_members;
create trigger village_members_notify_activity after insert or update of status on public.village_members
for each row execute function kinavela_private.notify_village_membership();
drop trigger if exists events_notify_invitation on public.events;
create trigger events_notify_invitation after insert on public.events
for each row execute function kinavela_private.notify_event_invitation();
drop trigger if exists event_attendees_notify_rsvp on public.event_attendees;
create trigger event_attendees_notify_rsvp after insert or update of status on public.event_attendees
for each row execute function kinavela_private.notify_event_rsvp();
drop trigger if exists playdates_notify_proposal on public.playdates;
create trigger playdates_notify_proposal after insert on public.playdates
for each row execute function kinavela_private.notify_playdate_proposal();
drop trigger if exists reports_notify_resolution on public.reports;
create trigger reports_notify_resolution after update of status on public.reports
for each row execute function kinavela_private.notify_report_resolution();

revoke all on function public.update_notification_preferences_v2(
  boolean,boolean,boolean,boolean,boolean,boolean,boolean
) from public,anon,authenticated,service_role;
grant execute on function public.get_notification_preferences(),
  public.update_notification_preferences_v2(
    boolean,boolean,boolean,boolean,boolean,boolean,boolean
  ) to authenticated;
revoke all on function public.claim_notification_deliveries(),
  public.complete_notification_delivery(uuid,text,text)
from public,anon,authenticated,service_role;
grant execute on function public.claim_notification_deliveries(),
  public.complete_notification_delivery(uuid,text,text) to service_role;

insert into kinavela_private.schema_migrations(version)
values('202608130020_notification_communication_reliability')
on conflict(version) do nothing;

notify pgrst,'reload schema';
commit;
