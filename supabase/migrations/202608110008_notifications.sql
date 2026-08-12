begin;

create table public.notification_preferences (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  email_enabled boolean not null default false,
  push_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.notification_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique check (char_length(endpoint) between 20 and 2048),
  p256dh text not null check (char_length(p256dh) between 20 and 512),
  auth text not null check (char_length(auth) between 10 and 256),
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create table public.notification_events (
  id uuid primary key default gen_random_uuid(),
  recipient_profile_id uuid not null references public.profiles(id) on delete cascade,
  notification_kind text not null check (notification_kind in ('connection_request', 'connection_accepted', 'message_received', 'event_reminder', 'village_activity', 'story_ready')),
  entity_type text not null check (entity_type ~ '^[a-z][a-z0-9_]{1,40}$'),
  entity_id uuid not null,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object' and pg_column_size(payload) <= 4000),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique(recipient_profile_id, notification_kind, entity_id)
);

create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  recipient_profile_id uuid not null references public.profiles(id) on delete cascade,
  channel text not null check (channel in ('in_app', 'email', 'push')),
  notification_kind text not null check (notification_kind in ('connection_request', 'connection_accepted', 'message_received', 'event_reminder', 'village_activity', 'story_ready')),
  entity_type text not null,
  entity_id uuid not null,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object' and pg_column_size(payload) <= 4000),
  scheduled_at timestamptz not null default now(),
  status text not null default 'queued' check (status in ('queued', 'processing', 'sent', 'failed', 'suppressed')),
  attempts smallint not null default 0 check (attempts between 0 and 5),
  error_code text check (error_code is null or error_code ~ '^[a-z0-9_]{2,80}$'),
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  unique(recipient_profile_id, channel, notification_kind, entity_id)
);

create index notification_events_recipient_idx on public.notification_events(recipient_profile_id, created_at desc);
create index notification_outbox_due_idx on public.notification_outbox(scheduled_at, created_at)
  where status in ('queued', 'processing');
create index notification_push_profile_idx on public.notification_push_subscriptions(profile_id);

alter table public.notification_preferences enable row level security;
alter table public.notification_preferences force row level security;
alter table public.notification_push_subscriptions enable row level security;
alter table public.notification_push_subscriptions force row level security;
alter table public.notification_events enable row level security;
alter table public.notification_events force row level security;
alter table public.notification_outbox enable row level security;
alter table public.notification_outbox force row level security;
revoke all on public.notification_preferences, public.notification_push_subscriptions, public.notification_events, public.notification_outbox from public, anon, authenticated;

create or replace function kinavela_private.enqueue_notification(
  p_recipient_profile_id uuid, p_kind text, p_entity_type text, p_entity_id uuid,
  p_payload jsonb default '{}'::jsonb, p_scheduled_at timestamptz default now()
)
returns void language plpgsql security definer set search_path = '' as $$
declare preferences public.notification_preferences%rowtype;
begin
  if p_kind not in ('connection_request', 'connection_accepted', 'message_received', 'event_reminder', 'village_activity', 'story_ready') then raise exception 'invalid_notification_kind'; end if;
  select * into preferences from public.notification_preferences where profile_id = p_recipient_profile_id;
  insert into public.notification_outbox(recipient_profile_id, channel, notification_kind, entity_type, entity_id, payload, scheduled_at)
    values (p_recipient_profile_id, 'in_app', p_kind, p_entity_type, p_entity_id, coalesce(p_payload, '{}'::jsonb), coalesce(p_scheduled_at, now())) on conflict do nothing;
  if coalesce(preferences.email_enabled, false) and exists (select 1 from public.consents consent where consent.profile_id = p_recipient_profile_id and consent.consent_type = 'product_email' and consent.revoked_at is null) then
    insert into public.notification_outbox(recipient_profile_id, channel, notification_kind, entity_type, entity_id, payload, scheduled_at)
      values (p_recipient_profile_id, 'email', p_kind, p_entity_type, p_entity_id, coalesce(p_payload, '{}'::jsonb), coalesce(p_scheduled_at, now())) on conflict do nothing;
  end if;
  if coalesce(preferences.push_enabled, false) and exists (select 1 from public.notification_push_subscriptions subscription where subscription.profile_id = p_recipient_profile_id) then
    insert into public.notification_outbox(recipient_profile_id, channel, notification_kind, entity_type, entity_id, payload, scheduled_at)
      values (p_recipient_profile_id, 'push', p_kind, p_entity_type, p_entity_id, coalesce(p_payload, '{}'::jsonb), coalesce(p_scheduled_at, now())) on conflict do nothing;
  end if;
end;
$$;

create or replace function public.get_notification_preferences()
returns table (email_enabled boolean, push_enabled boolean, push_subscription_count integer)
language sql stable security definer set search_path = '' as $$
  select coalesce(preferences.email_enabled, false), coalesce(preferences.push_enabled, false),
    (select count(*)::integer from public.notification_push_subscriptions subscription where subscription.profile_id = public.current_profile_id())
  from (select public.current_profile_id() as profile_id) current
  left join public.notification_preferences preferences on preferences.profile_id = current.profile_id;
$$;

create or replace function public.update_notification_preferences(p_email_enabled boolean, p_push_enabled boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare profile_uuid uuid := public.current_profile_id();
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  if p_push_enabled and not exists (select 1 from public.notification_push_subscriptions where profile_id = profile_uuid) then raise exception 'push_subscription_required'; end if;
  insert into public.notification_preferences(profile_id, email_enabled, push_enabled) values (profile_uuid, p_email_enabled, p_push_enabled)
    on conflict (profile_id) do update set email_enabled = excluded.email_enabled, push_enabled = excluded.push_enabled, updated_at = now();
  if p_email_enabled then
    insert into public.consents(profile_id, consent_type, policy_version) values (profile_uuid, 'product_email', 'notifications-v1') on conflict do nothing;
  else
    update public.consents set revoked_at = coalesce(revoked_at, now()) where profile_id = profile_uuid and consent_type = 'product_email' and revoked_at is null;
  end if;
  return true;
end;
$$;

create or replace function public.register_notification_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare profile_uuid uuid := public.current_profile_id(); subscription_uuid uuid;
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  if char_length(coalesce(p_endpoint, '')) not between 20 and 2048 or char_length(coalesce(p_p256dh, '')) not between 20 and 512 or char_length(coalesce(p_auth, '')) not between 10 and 256 then raise exception 'invalid_push_subscription'; end if;
  insert into public.notification_push_subscriptions(profile_id, endpoint, p256dh, auth) values (profile_uuid, p_endpoint, p_p256dh, p_auth)
    on conflict (endpoint) do update set profile_id = excluded.profile_id, p256dh = excluded.p256dh, auth = excluded.auth, last_used_at = now()
    returning id into subscription_uuid;
  insert into public.notification_preferences(profile_id, push_enabled) values (profile_uuid, true)
    on conflict (profile_id) do update set push_enabled = true, updated_at = now();
  return subscription_uuid;
end;
$$;

create or replace function public.revoke_notification_push_subscription(p_endpoint text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare profile_uuid uuid := public.current_profile_id();
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  delete from public.notification_push_subscriptions where profile_id = profile_uuid and endpoint = p_endpoint;
  update public.notification_preferences set push_enabled = false, updated_at = now() where profile_id = profile_uuid and not exists (select 1 from public.notification_push_subscriptions where profile_id = profile_uuid);
  return found;
end;
$$;

create or replace function public.list_notification_feed(p_limit integer default 50)
returns table (notification_id uuid, notification_kind text, entity_type text, entity_id uuid, payload jsonb, read_at timestamptz, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare profile_uuid uuid := public.current_profile_id();
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  if p_limit not between 1 and 100 then raise exception 'invalid_limit'; end if;
  return query select event.id, event.notification_kind, event.entity_type, event.entity_id, event.payload, event.read_at, event.created_at
    from public.notification_events event where event.recipient_profile_id = profile_uuid order by event.created_at desc limit p_limit;
end;
$$;

create or replace function public.mark_notification_event_read(p_notification_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare profile_uuid uuid := public.current_profile_id();
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  update public.notification_events set read_at = coalesce(read_at, now()) where id = p_notification_id and recipient_profile_id = profile_uuid;
  if not found then raise exception 'notification_not_found'; end if;
  return true;
end;
$$;

create or replace function public.claim_notification_deliveries()
returns table (delivery_id uuid, channel text, notification_kind text, recipient_email text, locale text, payload jsonb)
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'service_role_required'; end if;
  update public.notification_outbox set status = case when attempts >= 5 then 'failed' else 'queued' end, error_code = case when attempts >= 5 then 'delivery_retries_exhausted' else error_code end
    where status = 'processing' and created_at < now() - interval '15 minutes';
  return query
  with picked as (
    select outbox.id from public.notification_outbox outbox where outbox.status = 'queued' and outbox.scheduled_at <= now() and outbox.attempts < 5 order by outbox.scheduled_at, outbox.created_at for update skip locked limit 50
  ), claimed as (
    update public.notification_outbox outbox set status = 'processing', attempts = attempts + 1 where outbox.id in (select id from picked) returning outbox.*
  )
  select claimed.id, claimed.channel, claimed.notification_kind, auth_user.email, profile.preferred_language, claimed.payload
  from claimed join public.profiles profile on profile.id = claimed.recipient_profile_id
  join auth.users auth_user on auth_user.id = profile.auth_user_id;
end;
$$;

create or replace function public.complete_notification_delivery(p_delivery_id uuid, p_status text, p_error_code text default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare delivery public.notification_outbox%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'service_role_required'; end if;
  if p_status not in ('sent', 'failed', 'suppressed') then raise exception 'invalid_delivery_status'; end if;
  select * into delivery from public.notification_outbox where id = p_delivery_id for update;
  if delivery.id is null then raise exception 'delivery_not_found'; end if;
  update public.notification_outbox set status = p_status, error_code = left(nullif(p_error_code, ''), 80), delivered_at = case when p_status = 'sent' then now() else delivered_at end where id = p_delivery_id;
  if p_status = 'sent' and delivery.channel = 'in_app' then
    insert into public.notification_events(recipient_profile_id, notification_kind, entity_type, entity_id, payload) values (delivery.recipient_profile_id, delivery.notification_kind, delivery.entity_type, delivery.entity_id, delivery.payload) on conflict (recipient_profile_id, notification_kind, entity_id) do nothing;
  end if;
  return true;
end;
$$;

create or replace function kinavela_private.notify_existing_notification()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform kinavela_private.enqueue_notification(new.recipient_profile_id, new.notification_type, 'notification', new.id, jsonb_build_object('actor_family_id', new.actor_family_id, 'connection_id', new.connection_id));
  return new;
end;
$$;

create or replace function kinavela_private.notify_event_reminder()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform kinavela_private.enqueue_notification(new.recipient_profile_id, 'event_reminder', 'event_reminder', new.id, jsonb_build_object('event_id', new.event_id, 'reminder_kind', new.reminder_kind), new.due_at);
  return new;
end;
$$;

create or replace function kinavela_private.notify_story_ready()
returns trigger language plpgsql security definer set search_path = '' as $$
declare member record;
begin
  if old.ai_status is distinct from new.ai_status and new.ai_status = 'ready' then
    for member in select profile_id from public.family_members where family_id = new.family_id and status = 'active' and role in ('owner', 'guardian') loop
      perform kinavela_private.enqueue_notification(member.profile_id, 'story_ready', 'family_story', new.id, jsonb_build_object('child_id', new.child_id));
    end loop;
  end if;
  return new;
end;
$$;

create or replace function kinavela_private.notify_village_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare village_uuid uuid; member record;
begin
  select conversation.village_id into village_uuid from public.conversations conversation where conversation.id = new.conversation_id;
  if village_uuid is null then return new; end if;
  for member in select distinct family_member.profile_id from public.conversation_participants participant join public.family_members family_member on family_member.family_id = participant.family_id where participant.conversation_id = new.conversation_id and family_member.status = 'active' and family_member.profile_id <> new.sender_profile_id loop
    perform kinavela_private.enqueue_notification(member.profile_id, 'village_activity', 'village_message', new.id, jsonb_build_object('village_id', village_uuid));
  end loop;
  return new;
end;
$$;

drop trigger if exists notifications_enqueue_channels on public.notifications;
create trigger notifications_enqueue_channels after insert on public.notifications for each row execute function kinavela_private.notify_existing_notification();
drop trigger if exists event_reminders_enqueue_channels on public.event_reminder_deliveries;
create trigger event_reminders_enqueue_channels after insert on public.event_reminder_deliveries for each row execute function kinavela_private.notify_event_reminder();
drop trigger if exists stories_enqueue_channels on public.family_stories;
create trigger stories_enqueue_channels after update of ai_status on public.family_stories for each row execute function kinavela_private.notify_story_ready();
drop trigger if exists village_messages_enqueue_channels on public.messages;
create trigger village_messages_enqueue_channels after insert on public.messages for each row execute function kinavela_private.notify_village_activity();

revoke all on function kinavela_private.enqueue_notification(uuid, text, text, uuid, jsonb, timestamptz) from public, anon, authenticated, service_role;
revoke all on function public.get_notification_preferences(), public.update_notification_preferences(boolean, boolean), public.register_notification_push_subscription(text, text, text), public.revoke_notification_push_subscription(text), public.list_notification_feed(integer), public.mark_notification_event_read(uuid), public.claim_notification_deliveries(), public.complete_notification_delivery(uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function public.get_notification_preferences(), public.update_notification_preferences(boolean, boolean), public.register_notification_push_subscription(text, text, text), public.revoke_notification_push_subscription(text), public.list_notification_feed(integer), public.mark_notification_event_read(uuid) to authenticated;
grant execute on function public.claim_notification_deliveries(), public.complete_notification_delivery(uuid, text, text) to service_role;

insert into kinavela_private.schema_migrations(version)
values ('202608110008_notifications')
on conflict (version) do nothing;

notify pgrst, 'reload schema';
commit;
