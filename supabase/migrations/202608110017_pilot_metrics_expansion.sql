begin;

create table if not exists kinavela_private.pilot_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default true,
  allowed_country_codes text[] not null default array['DE']::text[],
  max_active_families integer not null default 50 check (max_active_families between 20 and 500),
  density_threshold integer not null default 10 check (density_threshold between 3 and 100),
  updated_at timestamptz not null default now()
);
insert into kinavela_private.pilot_settings(id) values (true) on conflict (id) do nothing;

create table if not exists kinavela_private.pilot_regions (
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  city text not null check (char_length(city) between 2 and 120),
  status text not null default 'open' check (status in ('waitlist','open','paused')),
  threshold integer not null default 10 check (threshold between 3 and 100),
  updated_at timestamptz not null default now(),
  primary key(country_code, city)
);
insert into kinavela_private.pilot_regions(country_code, city, status, threshold)
values
  ('DE', 'Berlin', 'open', 10),
  ('DE', 'Frankfurt', 'open', 10),
  ('DE', 'Ingolstadt', 'open', 10),
  ('DE', 'Kaiserslautern', 'open', 10),
  ('DE', 'Mainz', 'open', 10),
  ('DE', 'Munich', 'open', 10),
  ('DE', 'Saarbrücken', 'open', 10),
  ('DE', 'Stuttgart', 'open', 10)
on conflict (country_code, city) do nothing;

create table public.pilot_waitlist (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  city text not null check (char_length(btrim(city)) between 2 and 120),
  culture_focus text not null default 'cameroon' check (culture_focus ~ '^[a-z][a-z0-9_-]{2,40}$'),
  status text not null default 'waiting' check (status in ('waiting','invited','activated','withdrawn')),
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index pilot_waitlist_profile_region_idx on public.pilot_waitlist(profile_id, country_code, lower(city)) where status in ('waiting','invited');
create index pilot_waitlist_density_idx on public.pilot_waitlist(country_code, lower(city), status, joined_at);
alter table public.pilot_waitlist enable row level security;
alter table public.pilot_waitlist force row level security;
revoke all on public.pilot_waitlist from public, anon, authenticated;
grant all on public.pilot_waitlist to service_role;
create trigger pilot_waitlist_set_updated_at before update on public.pilot_waitlist for each row execute function public.set_updated_at();

create table public.product_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  event_name text not null check (event_name in (
    'app_session_started','discovery_opened','onboarding_completed','connection_requested','connection_accepted',
    'village_created','event_created','event_rsvp','event_attended','roots_entry_created','story_request_created',
    'story_submitted','real_life_meeting_confirmed'
  )),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object' and pg_column_size(metadata) <= 2000),
  occurred_at timestamptz not null default now()
);
create index product_events_name_time_idx on public.product_events(event_name, occurred_at desc);
create index product_events_profile_time_idx on public.product_events(profile_id, occurred_at desc);
alter table public.product_events enable row level security;
alter table public.product_events force row level security;
revoke all on public.product_events from public, anon, authenticated;
grant all on public.product_events to service_role;

create or replace function kinavela_private.capture_pilot_audit_event()
returns trigger language plpgsql security definer set search_path = '' as $$
declare mapped_name text;
begin
  mapped_name := case new.event_type
    when 'onboarding_completed' then 'onboarding_completed'
    when 'connection_requested' then 'connection_requested'
    when 'connection_accepted' then 'connection_accepted'
    when 'village_created' then 'village_created'
    when 'event_created' then 'event_created'
    when 'event_rsvp' then 'event_rsvp'
    when 'event_attended' then 'event_attended'
    when 'roots_entry_created' then 'roots_entry_created'
    when 'story_request_created' then 'story_request_created'
    when 'story_submitted' then 'story_submitted'
    when 'real_life_meeting_confirmed' then 'real_life_meeting_confirmed'
    else null
  end;
  if mapped_name is not null and new.actor_profile_id is not null then
    insert into public.product_events(profile_id, event_name, metadata, occurred_at)
    values (new.actor_profile_id, mapped_name, coalesce(new.metadata, '{}'::jsonb), new.created_at);
  end if;
  return new;
end;
$$;
drop trigger if exists audit_events_capture_pilot_metrics on public.audit_events;
create trigger audit_events_capture_pilot_metrics after insert on public.audit_events for each row execute function kinavela_private.capture_pilot_audit_event();
revoke all on function kinavela_private.capture_pilot_audit_event() from public, anon, authenticated, service_role;

create or replace function kinavela_private.enforce_pilot_family_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare settings kinavela_private.pilot_settings%rowtype; active_families integer;
begin
  select * into settings from kinavela_private.pilot_settings where id = true;
  if coalesce(settings.enabled, false) then
    if not (upper(new.country_of_residence) = any(settings.allowed_country_codes)) then raise exception 'pilot_country_closed'; end if;
    perform pg_advisory_xact_lock(hashtextextended('kinavela-pilot-family-cap', 0));
    select count(*)::integer into active_families from public.families family join public.profiles profile on profile.id = family.created_by where profile.status = 'active' and family.country_of_residence = any(settings.allowed_country_codes);
    if active_families >= settings.max_active_families then raise exception 'pilot_capacity_reached'; end if;
  end if;
  return new;
end;
$$;
drop trigger if exists families_enforce_pilot_limit on public.families;
create trigger families_enforce_pilot_limit before insert on public.families for each row execute function kinavela_private.enforce_pilot_family_limit();
revoke all on function kinavela_private.enforce_pilot_family_limit() from public, anon, authenticated, service_role;

create or replace function public.track_product_event(p_event_name text, p_metadata jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare profile_uuid uuid := public.current_profile_id(); event_uuid uuid;
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  if p_event_name not in ('app_session_started','discovery_opened') then raise exception 'event_requires_server_confirmation'; end if;
  if jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) <> 'object' or pg_column_size(coalesce(p_metadata, '{}'::jsonb)) > 2000 then raise exception 'invalid_event_metadata'; end if;
  insert into public.product_events(profile_id, event_name, metadata) values (profile_uuid, p_event_name, coalesce(p_metadata, '{}'::jsonb)) returning id into event_uuid;
  return event_uuid;
end;
$$;

create or replace function public.join_pilot_waitlist(p_country_code text, p_city text, p_culture_focus text default 'cameroon')
returns uuid language plpgsql security definer set search_path = '' as $$
declare profile_uuid uuid := public.current_profile_id(); waitlist_uuid uuid;
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.profiles where id = profile_uuid and status = 'active') then raise exception 'account_not_active'; end if;
  if upper(p_country_code) <> 'DE' or char_length(btrim(coalesce(p_city, ''))) not between 2 and 120 or coalesce(p_culture_focus, 'cameroon') !~ '^[a-z][a-z0-9_-]{2,40}$' then raise exception 'invalid_pilot_region'; end if;
  insert into public.pilot_waitlist(profile_id, country_code, city, culture_focus) values (profile_uuid, 'DE', btrim(p_city), lower(coalesce(p_culture_focus, 'cameroon')))
    on conflict (profile_id, country_code, lower(city)) where status in ('waiting','invited') do update set updated_at = now(), status = 'waiting'
    returning id into waitlist_uuid;
  return waitlist_uuid;
end;
$$;

create or replace function public.list_my_pilot_waitlist()
returns table(waitlist_id uuid, country_code text, city text, culture_focus text, status text, joined_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select id, country_code, city, culture_focus, status, joined_at from public.pilot_waitlist where profile_id = public.current_profile_id() and status <> 'withdrawn' order by joined_at desc;
$$;

create or replace function public.record_real_life_meeting(p_connection_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare profile_uuid uuid := public.current_profile_id(); family_uuid uuid;
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  family_uuid := kinavela_private.current_family_id(true);
  if family_uuid is null or not exists (select 1 from public.family_connections connection where connection.id = p_connection_id and connection.status = 'accepted' and family_uuid in (connection.requester_family_id, connection.recipient_family_id)) then raise exception 'connection_not_accepted'; end if;
  insert into public.audit_events(actor_profile_id, event_type, entity_type, entity_id, metadata) values (profile_uuid, 'real_life_meeting_confirmed', 'family_connection', p_connection_id, jsonb_build_object('family_id', family_uuid));
  return true;
end;
$$;

create or replace function public.admin_list_pilot_metrics(p_from timestamptz default now() - interval '30 days')
returns table(metric_key text, metric_value numeric, denominator numeric, as_of timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare start_at timestamptz := greatest(coalesce(p_from, now() - interval '30 days'), now() - interval '365 days');
begin
  if not kinavela_private.is_admin(public.current_profile_id()) then raise exception 'admin_required'; end if;
  return query
  with profiles as (select count(*)::numeric total, count(*) filter (where onboarding_completed)::numeric completed from public.profiles where status = 'active'),
  families as (select count(*)::numeric total, count(*) filter (where location is not null)::numeric located from public.families),
  events as (select event_name, count(*)::numeric count, count(distinct profile_id)::numeric profiles from public.product_events where occurred_at >= start_at group by event_name),
  requests as (select count(*)::numeric count, count(distinct actor_profile_id)::numeric profiles from public.audit_events where event_type = 'connection_requested' and created_at >= start_at),
  accepts as (select count(*)::numeric count, count(distinct actor_profile_id)::numeric profiles from public.audit_events where event_type = 'connection_accepted' and created_at >= start_at),
  first_connections as (select avg(extract(epoch from accepted.created_at - requested.created_at))::numeric seconds, count(*)::numeric denominator from (select actor_profile_id, min(created_at) filter (where event_type = 'connection_requested') requested_at from public.audit_events group by actor_profile_id) requested join lateral (select min(created_at) created_at from public.audit_events accepted where accepted.actor_profile_id = requested.actor_profile_id and accepted.event_type = 'connection_accepted' and accepted.created_at >= requested.requested_at) accepted on accepted.created_at is not null),
  mature_profiles as (select profile.id from public.profiles profile where profile.status = 'active' and profile.created_at <= now() - interval '30 days'),
  retained as (select count(*)::numeric count from mature_profiles profile where exists (select 1 from public.product_events event where event.profile_id = profile.id and event.event_name = 'app_session_started' and event.occurred_at >= profile.created_at + interval '30 days'))
  select * from (values
    ('onboarding_completion', coalesce((select completed / nullif(total, 0) * 100 from profiles), 0), coalesce((select total from profiles), 0)),
    ('families_with_matching_radius', coalesce((select located / nullif(total, 0) * 100 from families), 0), coalesce((select total from families), 0)),
    ('match_open_rate', coalesce((select count / nullif((select count from events where event_name = 'app_session_started'), 0) * 100 from events where event_name = 'discovery_opened'), 0), coalesce((select count from events where event_name = 'app_session_started'), 0)),
    ('connection_request_rate', coalesce((select profiles / nullif((select completed from profiles), 0) * 100 from requests), 0), coalesce((select completed from profiles), 0)),
    ('acceptance_rate', coalesce((select count / nullif((select count from requests), 0) * 100 from accepts), 0), coalesce((select count from requests), 0)),
    ('time_to_first_connection_seconds', coalesce((select seconds from first_connections), 0), coalesce((select denominator from first_connections), 0)),
    ('village_formation', coalesce((select profiles / nullif((select completed from profiles), 0) * 100 from events where event_name = 'village_created'), 0), coalesce((select completed from profiles), 0)),
    ('event_creation', coalesce((select count from events where event_name = 'event_created'), 0), coalesce((select count from events where event_name = 'village_created'), 0)),
    ('event_attendance', coalesce((select count from events where event_name = 'event_attended'), 0), coalesce((select count from events where event_name = 'event_rsvp'), 0)),
    ('retention_30_day', coalesce((select count / nullif((select count(*)::numeric from mature_profiles), 0) * 100 from retained), 0), coalesce((select count(*)::numeric from mature_profiles), 0)),
    ('passport_creation', coalesce((select count from events where event_name = 'roots_entry_created'), 0), coalesce((select completed from profiles), 0)),
    ('roots_story_usage', coalesce((select count from events where event_name = 'story_request_created'), 0), coalesce((select completed from profiles), 0)),
    ('real_life_meeting_confirmed', coalesce((select profiles from events where event_name = 'real_life_meeting_confirmed'), 0), coalesce((select completed from profiles), 0))
  ) result(metric_key, metric_value, denominator), (select now()) clock;
end;
$$;

create or replace function public.admin_list_regional_density()
returns table(country_code text, city text, waiting_count bigint, family_count bigint, threshold integer, rollout_status text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not kinavela_private.is_admin(public.current_profile_id()) then raise exception 'admin_required'; end if;
  return query select region.country_code, region.city,
    (select count(*) from public.pilot_waitlist waitlist where waitlist.country_code = region.country_code and lower(waitlist.city) = lower(region.city) and waitlist.status in ('waiting','invited')),
    (select count(*) from public.families family where family.country_of_residence = region.country_code and lower(family.city) = lower(region.city)),
    region.threshold, region.status from kinavela_private.pilot_regions region order by region.country_code, region.city;
end;
$$;

revoke all on function public.track_product_event(text,jsonb), public.join_pilot_waitlist(text,text,text), public.list_my_pilot_waitlist(), public.record_real_life_meeting(uuid) from public, anon, service_role;
grant execute on function public.track_product_event(text,jsonb), public.join_pilot_waitlist(text,text,text), public.list_my_pilot_waitlist(), public.record_real_life_meeting(uuid) to authenticated;
revoke all on function public.admin_list_pilot_metrics(timestamptz), public.admin_list_regional_density() from public, anon, authenticated, service_role;
grant execute on function public.admin_list_pilot_metrics(timestamptz), public.admin_list_regional_density() to authenticated;

insert into kinavela_private.schema_migrations(version) values ('202608110017_pilot_metrics_expansion') on conflict (version) do nothing;
notify pgrst, 'reload schema';
commit;
