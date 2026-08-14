begin;

create table public.discovery_alert_subscriptions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null unique references public.families(id) on delete cascade,
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  radius_km integer not null check (radius_km between 5 and 100),
  active boolean not null default true,
  last_evaluated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.discovery_alert_matches (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.discovery_alert_subscriptions(id) on delete cascade,
  candidate_family_id uuid not null references public.families(id) on delete cascade,
  matched_at timestamptz not null default now(),
  unique(subscription_id, candidate_family_id)
);

create table public.discovery_alert_batches (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.discovery_alert_subscriptions(id) on delete cascade,
  match_count integer not null check (match_count between 1 and 1000),
  radius_km integer not null check (radius_km between 5 and 100),
  created_at timestamptz not null default now()
);

create index discovery_alert_subscriptions_active_idx
  on public.discovery_alert_subscriptions(updated_at)
  where active;
create index discovery_alert_matches_subscription_idx
  on public.discovery_alert_matches(subscription_id, matched_at desc);
create index discovery_alert_batches_subscription_idx
  on public.discovery_alert_batches(subscription_id, created_at desc);

create trigger discovery_alert_subscriptions_set_updated_at
  before update on public.discovery_alert_subscriptions
  for each row execute function public.set_updated_at();

alter table public.discovery_alert_subscriptions enable row level security;
alter table public.discovery_alert_subscriptions force row level security;
alter table public.discovery_alert_matches enable row level security;
alter table public.discovery_alert_matches force row level security;
alter table public.discovery_alert_batches enable row level security;
alter table public.discovery_alert_batches force row level security;

revoke all on public.discovery_alert_subscriptions,
  public.discovery_alert_matches, public.discovery_alert_batches
from public, anon, authenticated;

alter table public.notification_events
  drop constraint notification_events_notification_kind_check;
alter table public.notification_events
  add constraint notification_events_notification_kind_check
  check (notification_kind in (
    'connection_request', 'connection_accepted', 'message_received',
    'event_reminder', 'village_activity', 'story_ready',
    'compatible_family_available'
  ));
alter table public.notification_outbox
  drop constraint notification_outbox_notification_kind_check;
alter table public.notification_outbox
  add constraint notification_outbox_notification_kind_check
  check (notification_kind in (
    'connection_request', 'connection_accepted', 'message_received',
    'event_reminder', 'village_activity', 'story_ready',
    'compatible_family_available'
  ));

create or replace function kinavela_private.enqueue_notification(
  p_recipient_profile_id uuid, p_kind text, p_entity_type text, p_entity_id uuid,
  p_payload jsonb default '{}'::jsonb, p_scheduled_at timestamptz default now()
)
returns void language plpgsql security definer set search_path = '' as $$
declare preferences public.notification_preferences%rowtype;
begin
  if p_kind not in (
    'connection_request', 'connection_accepted', 'message_received',
    'event_reminder', 'village_activity', 'story_ready',
    'compatible_family_available'
  ) then raise exception 'invalid_notification_kind'; end if;
  select * into preferences from public.notification_preferences
  where profile_id = p_recipient_profile_id;
  insert into public.notification_outbox(
    recipient_profile_id, channel, notification_kind, entity_type,
    entity_id, payload, scheduled_at
  ) values (
    p_recipient_profile_id, 'in_app', p_kind, p_entity_type,
    p_entity_id, coalesce(p_payload, '{}'::jsonb), coalesce(p_scheduled_at, now())
  ) on conflict do nothing;
  if coalesce(preferences.email_enabled, false) and exists (
    select 1 from public.consents consent
    where consent.profile_id = p_recipient_profile_id
      and consent.consent_type = 'product_email' and consent.revoked_at is null
  ) then
    insert into public.notification_outbox(
      recipient_profile_id, channel, notification_kind, entity_type,
      entity_id, payload, scheduled_at
    ) values (
      p_recipient_profile_id, 'email', p_kind, p_entity_type,
      p_entity_id, coalesce(p_payload, '{}'::jsonb), coalesce(p_scheduled_at, now())
    ) on conflict do nothing;
  end if;
  if coalesce(preferences.push_enabled, false) and exists (
    select 1 from public.notification_push_subscriptions subscription
    where subscription.profile_id = p_recipient_profile_id
  ) then
    insert into public.notification_outbox(
      recipient_profile_id, channel, notification_kind, entity_type,
      entity_id, payload, scheduled_at
    ) values (
      p_recipient_profile_id, 'push', p_kind, p_entity_type,
      p_entity_id, coalesce(p_payload, '{}'::jsonb), coalesce(p_scheduled_at, now())
    ) on conflict do nothing;
  end if;
end;
$$;

create or replace function public.get_my_discovery_alert()
returns table (
  subscription_id uuid,
  active boolean,
  radius_km integer,
  last_evaluated_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  profile_uuid uuid := public.current_profile_id();
  family_uuid uuid := kinavela_private.current_family_id(false);
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  if family_uuid is null then raise exception 'family_not_found'; end if;
  return query
  select subscription.id, subscription.active, subscription.radius_km,
    subscription.last_evaluated_at, subscription.created_at
  from public.discovery_alert_subscriptions subscription
  where subscription.family_id = family_uuid;
end;
$$;

create or replace function public.update_my_discovery_alert(
  p_active boolean,
  p_radius_km integer default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_uuid uuid := public.current_profile_id();
  family_uuid uuid := kinavela_private.current_family_id(true);
  family_radius integer;
  subscription_uuid uuid;
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  if family_uuid is null then raise exception 'owner_required'; end if;
  select family.discovery_radius_km into family_radius
  from public.families family
  where family.id = family_uuid and family.location is not null;
  if family_radius is null then raise exception 'location_required'; end if;

  if p_active then
    if p_radius_km is null or p_radius_km not between 5 and family_radius then
      raise exception 'invalid_alert_radius';
    end if;
    insert into public.discovery_alert_subscriptions(
      family_id, owner_profile_id, radius_km, active
    ) values (family_uuid, profile_uuid, p_radius_km, true)
    on conflict(family_id) do update
      set owner_profile_id = excluded.owner_profile_id,
          radius_km = excluded.radius_km,
          active = true,
          updated_at = now()
    returning id into subscription_uuid;
  else
    update public.discovery_alert_subscriptions
    set active = false, updated_at = now()
    where family_id = family_uuid and active
    returning id into subscription_uuid;
    if subscription_uuid is null then raise exception 'alert_not_available'; end if;
  end if;

  insert into public.audit_events(
    actor_profile_id, event_type, entity_type, entity_id,
    metadata
  ) values (
    profile_uuid,
    case when p_active then 'discovery_alert_enabled' else 'discovery_alert_revoked' end,
    'discovery_alert', subscription_uuid,
    jsonb_build_object('active', p_active, 'radius_km', p_radius_km)
  );
  return subscription_uuid;
end;
$$;

create or replace function public.dispatch_compatible_family_alerts()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  subscription record;
  batch_uuid uuid;
  new_match_count integer;
  batch_count integer := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  for subscription in
    select alert.id, alert.family_id, alert.owner_profile_id, alert.radius_km,
      family.location, family.discovery_radius_km
    from public.discovery_alert_subscriptions alert
    join public.families family on family.id = alert.family_id
    join public.profiles profile on profile.id = alert.owner_profile_id
    where alert.active and family.location is not null
      and profile.status = 'active'
    order by alert.updated_at
    for update of alert skip locked
  loop
    with candidates as (
      select candidate.id,
        extensions.st_distance(subscription.location, candidate.location) / 1000.0
          as distance_km
      from public.families candidate
      where candidate.id <> subscription.family_id
        and candidate.visibility = 'discoverable'
        and candidate.location is not null
        and extensions.st_dwithin(
          subscription.location,
          candidate.location,
          least(
            subscription.radius_km,
            subscription.discovery_radius_km,
            candidate.discovery_radius_km
          ) * 1000.0
        )
        and exists (
          select 1 from public.family_members member
          join public.profiles profile on profile.id = member.profile_id
          where member.family_id = candidate.id and member.status = 'active'
            and profile.status = 'active'
        )
        and not exists (
          select 1 from public.discovery_blocks block
          where (block.blocker_family_id = subscription.family_id
              and block.blocked_family_id = candidate.id)
             or (block.blocked_family_id = subscription.family_id
              and block.blocker_family_id = candidate.id)
        )
        and not exists (
          select 1 from public.family_connections connection
          where connection.status in ('requested', 'accepted')
            and (
              (connection.requester_family_id = subscription.family_id
                and connection.recipient_family_id = candidate.id)
              or (connection.recipient_family_id = subscription.family_id
                and connection.requester_family_id = candidate.id)
            )
        )
    ), compatible as (
      select candidate.id
      from candidates candidate
      where (
        kinavela_private.calculate_family_match(
          subscription.family_id,
          candidate.id,
          candidate.distance_km,
          subscription.radius_km
        ) ->> 'score'
      )::integer >= 40
    ), inserted as (
      insert into public.discovery_alert_matches(
        subscription_id, candidate_family_id
      )
      select subscription.id, compatible.id from compatible
      on conflict(subscription_id, candidate_family_id) do nothing
      returning id
    )
    select count(*)::integer into new_match_count from inserted;

    update public.discovery_alert_subscriptions
    set last_evaluated_at = now()
    where id = subscription.id;

    if new_match_count > 0 then
      insert into public.discovery_alert_batches(
        subscription_id, match_count, radius_km
      ) values (subscription.id, new_match_count, subscription.radius_km)
      returning id into batch_uuid;
      perform kinavela_private.enqueue_notification(
        subscription.owner_profile_id,
        'compatible_family_available',
        'discovery_alert_batch',
        batch_uuid,
        jsonb_build_object(
          'match_count', new_match_count,
          'radius_km', subscription.radius_km
        )
      );
      batch_count := batch_count + 1;
    end if;
  end loop;
  return batch_count;
end;
$$;

revoke all on function public.get_my_discovery_alert(),
  public.update_my_discovery_alert(boolean, integer),
  public.dispatch_compatible_family_alerts()
from public, anon, authenticated, service_role;
grant execute on function public.get_my_discovery_alert(),
  public.update_my_discovery_alert(boolean, integer)
to authenticated;
grant execute on function public.dispatch_compatible_family_alerts()
to service_role;

comment on function public.dispatch_compatible_family_alerts() is
  'Creates one identity-free notification batch per subscription run; candidate identifiers remain internal for deduplication.';

insert into kinavela_private.schema_migrations(version)
values ('202608130006_discovery_activation_alerts');

select pg_notify('pgrst', 'reload schema');

commit;
