begin;

create table public.geocoding_cache (
  query_hash text not null check (char_length(query_hash) = 64),
  provider_place_id text not null check (char_length(provider_place_id) between 3 and 160),
  display_city text not null check (char_length(display_city) between 2 and 120),
  display_area text check (display_area is null or char_length(display_area) between 2 and 120),
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  location extensions.geography(Point, 4326) not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days',
  primary key (provider_place_id),
  check (expires_at > created_at)
);

create index geocoding_cache_query_idx on public.geocoding_cache(query_hash);
create index geocoding_cache_expiry_idx on public.geocoding_cache(expires_at);

create table public.geocoding_rate_limits (
  identifier_hash text primary key check (char_length(identifier_hash) = 64),
  window_started_at timestamptz not null default now(),
  attempts integer not null default 1 check (attempts > 0)
);

create table public.geocoding_provider_state (
  id smallint primary key check (id = 1),
  last_request_at timestamptz not null default '-infinity'::timestamptz
);

insert into public.geocoding_provider_state(id) values (1)
on conflict (id) do nothing;

create table public.discovery_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_family_id uuid not null references public.families(id) on delete cascade,
  blocked_family_id uuid not null references public.families(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(blocker_family_id, blocked_family_id),
  check (blocker_family_id <> blocked_family_id)
);

create index discovery_blocks_blocker_idx on public.discovery_blocks(blocker_family_id);
create index discovery_blocks_blocked_idx on public.discovery_blocks(blocked_family_id);

alter table public.geocoding_cache enable row level security;
alter table public.geocoding_cache force row level security;
alter table public.geocoding_rate_limits enable row level security;
alter table public.geocoding_rate_limits force row level security;
alter table public.geocoding_provider_state enable row level security;
alter table public.geocoding_provider_state force row level security;
alter table public.discovery_blocks enable row level security;
alter table public.discovery_blocks force row level security;

create policy "Owners read blocks they created"
  on public.discovery_blocks
  for select
  to authenticated
  using (public.is_family_owner(blocker_family_id));

revoke all on public.geocoding_cache, public.geocoding_rate_limits,
  public.geocoding_provider_state, public.discovery_blocks from public, anon, authenticated;
grant select on public.discovery_blocks to authenticated;

create or replace function public.consume_geocoding_rate_limit(
  p_identifier_hash text,
  p_max_attempts integer default 10,
  p_window_seconds integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  resulting_attempts integer;
begin
  if char_length(p_identifier_hash) <> 64
     or p_max_attempts not between 1 and 30
     or p_window_seconds not between 30 and 3600 then
    return false;
  end if;

  insert into public.geocoding_rate_limits(identifier_hash)
  values (p_identifier_hash)
  on conflict(identifier_hash) do update
    set attempts = case
      when public.geocoding_rate_limits.window_started_at < now() - make_interval(secs => p_window_seconds) then 1
      else public.geocoding_rate_limits.attempts + 1
    end,
    window_started_at = case
      when public.geocoding_rate_limits.window_started_at < now() - make_interval(secs => p_window_seconds) then now()
      else public.geocoding_rate_limits.window_started_at
    end
  returning attempts into resulting_attempts;

  return resulting_attempts <= p_max_attempts;
end;
$$;

create or replace function public.claim_geocoding_provider_slot()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed boolean := false;
begin
  update public.geocoding_provider_state
  set last_request_at = clock_timestamp()
  where id = 1
    and last_request_at <= clock_timestamp() - interval '1 second'
  returning true into claimed;
  return coalesce(claimed, false);
end;
$$;

create or replace function public.complete_family_onboarding_with_location(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  family_uuid uuid;
  place_id text := trim(p_payload #>> '{family,location_place_id}');
  cached_place public.geocoding_cache%rowtype;
begin
  if place_id is null or char_length(place_id) not between 3 and 160 then
    raise exception 'invalid_location';
  end if;

  select * into cached_place
  from public.geocoding_cache
  where provider_place_id = place_id and expires_at > now();
  if not found then raise exception 'invalid_location'; end if;

  family_uuid := public.complete_family_onboarding(p_payload);

  update public.families
  set city = cached_place.display_city,
      country_of_residence = cached_place.country_code,
      location = cached_place.location,
      location_precision = 'city',
      updated_at = now()
  where id = family_uuid;

  update public.profiles
  set city = cached_place.display_city,
      country_of_residence = cached_place.country_code,
      updated_at = now()
  where id = public.current_profile_id();

  return family_uuid;
end;
$$;

create or replace function public.set_family_location(
  p_provider_place_id text,
  p_radius_km integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_uuid uuid := public.current_profile_id();
  family_uuid uuid;
  cached_place public.geocoding_cache%rowtype;
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  if p_radius_km not between 5 and 100 then raise exception 'invalid_radius'; end if;

  select fm.family_id into family_uuid
  from public.family_members fm
  where fm.profile_id = profile_uuid and fm.role = 'owner' and fm.status = 'active'
  order by fm.created_at
  limit 1;
  if family_uuid is null then raise exception 'not_authorized'; end if;

  select * into cached_place
  from public.geocoding_cache
  where provider_place_id = trim(p_provider_place_id) and expires_at > now();
  if not found then raise exception 'invalid_location'; end if;

  update public.families
  set city = cached_place.display_city,
      country_of_residence = cached_place.country_code,
      location = cached_place.location,
      location_precision = 'city',
      discovery_radius_km = p_radius_km,
      updated_at = now()
  where id = family_uuid;

  update public.discovery_preferences
  set radius_km = p_radius_km, updated_at = now()
  where family_id = family_uuid;

  update public.profiles
  set city = cached_place.display_city,
      country_of_residence = cached_place.country_code,
      updated_at = now()
  where id = profile_uuid;

  insert into public.audit_events(actor_profile_id, event_type, entity_type, entity_id, metadata)
  values (profile_uuid, 'privacy_setting_changed', 'family', family_uuid, '{"setting":"approximate_location"}'::jsonb);
  return family_uuid;
end;
$$;

create or replace function public.set_discovery_block(
  p_target_family_id uuid,
  p_blocked boolean default true
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_uuid uuid := public.current_profile_id();
  family_uuid uuid;
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  select fm.family_id into family_uuid
  from public.family_members fm
  where fm.profile_id = profile_uuid and fm.role = 'owner' and fm.status = 'active'
  order by fm.created_at
  limit 1;
  if family_uuid is null or family_uuid = p_target_family_id then raise exception 'not_authorized'; end if;
  if not exists (select 1 from public.families where id = p_target_family_id) then
    raise exception 'family_not_found';
  end if;

  if p_blocked then
    insert into public.discovery_blocks(blocker_family_id, blocked_family_id, created_by)
    values (family_uuid, p_target_family_id, profile_uuid)
    on conflict(blocker_family_id, blocked_family_id) do nothing;
    insert into public.audit_events(actor_profile_id, event_type, entity_type, entity_id)
    values (profile_uuid, 'family_blocked', 'family', p_target_family_id);
  else
    delete from public.discovery_blocks
    where blocker_family_id = family_uuid and blocked_family_id = p_target_family_id;
    insert into public.audit_events(actor_profile_id, event_type, entity_type, entity_id)
    values (profile_uuid, 'family_unblocked', 'family', p_target_family_id);
  end if;
  return true;
end;
$$;

create or replace function public.discover_families(
  p_radius_km integer default null,
  p_culture_ids uuid[] default null,
  p_language_ids uuid[] default null,
  p_interest_ids uuid[] default null,
  p_min_child_age integer default null,
  p_max_child_age integer default null,
  p_limit integer default 30,
  p_offset integer default 0
)
returns table (
  family_id uuid,
  family_name text,
  display_city text,
  distance_bucket text,
  child_age_ranges text[],
  cultures text[],
  languages text[],
  shared_interests text[],
  compatibility_reasons text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  requester_profile uuid := public.current_profile_id();
  requester_family public.families%rowtype;
  effective_radius integer;
begin
  if requester_profile is null then raise exception 'not_authenticated'; end if;
  select f.* into requester_family
  from public.families f
  join public.family_members fm on fm.family_id = f.id
  where fm.profile_id = requester_profile and fm.status = 'active'
  order by fm.created_at
  limit 1;
  if requester_family.id is null then raise exception 'family_not_found'; end if;
  if requester_family.location is null then raise exception 'location_required'; end if;
  if p_radius_km is not null and p_radius_km not between 5 and 100 then raise exception 'invalid_radius'; end if;
  if p_min_child_age is not null and p_min_child_age not between 0 and 20 then raise exception 'invalid_age'; end if;
  if p_max_child_age is not null and p_max_child_age not between 0 and 20 then raise exception 'invalid_age'; end if;
  if p_min_child_age is not null and p_max_child_age is not null and p_min_child_age > p_max_child_age then
    raise exception 'invalid_age';
  end if;
  if p_limit not between 1 and 50 or p_offset not between 0 and 1000 then raise exception 'invalid_pagination'; end if;
  effective_radius := least(coalesce(p_radius_km, requester_family.discovery_radius_km), requester_family.discovery_radius_km);

  return query
  with candidates as (
    select f.*,
      extensions.st_distance(requester_family.location, f.location) / 1000.0 as distance_km
    from public.families f
    where f.id <> requester_family.id
      and f.visibility = 'discoverable'
      and f.location is not null
      and extensions.st_dwithin(requester_family.location, f.location, least(effective_radius, f.discovery_radius_km) * 1000.0)
      and not exists (
        select 1 from public.discovery_blocks b
        where (b.blocker_family_id = requester_family.id and b.blocked_family_id = f.id)
           or (b.blocker_family_id = f.id and b.blocked_family_id = requester_family.id)
      )
      and (p_culture_ids is null or exists (
        select 1 from public.family_cultures fc where fc.family_id = f.id and fc.culture_id = any(p_culture_ids)
      ))
      and (p_language_ids is null or exists (
        select 1 from public.family_languages fl where fl.family_id = f.id and fl.language_id = any(p_language_ids)
      ))
      and (p_interest_ids is null or exists (
        select 1 from public.family_interests fi where fi.family_id = f.id and fi.interest_id = any(p_interest_ids)
      ))
      and ((p_min_child_age is null and p_max_child_age is null) or exists (
        select 1 from public.children c
        where c.family_id = f.id
          and extract(year from age(current_date, make_date(c.birth_year, coalesce(c.birth_month, 7), 1)))::integer
              between coalesce(p_min_child_age, 0) and coalesce(p_max_child_age, 20)
      ))
  ), enriched as (
    select c.*,
      coalesce((select array_agg(distinct cu.name order by cu.name)
        from public.family_cultures fc join public.cultures cu on cu.id = fc.culture_id where fc.family_id = c.id), '{}'::text[]) as culture_names,
      coalesce((select array_agg(distinct l.name order by l.name)
        from public.family_languages fl join public.languages l on l.id = fl.language_id where fl.family_id = c.id), '{}'::text[]) as language_names,
      coalesce((select array_agg(distinct i.slug order by i.slug)
        from public.family_interests fi join public.interests i on i.id = fi.interest_id
        where fi.family_id = c.id and exists (
          select 1 from public.family_interests own_fi where own_fi.family_id = requester_family.id and own_fi.interest_id = fi.interest_id
        )), '{}'::text[]) as shared_interest_names,
      coalesce((select array_agg(distinct case
          when child_age <= 2 then '0-2'
          when child_age <= 5 then '3-5'
          when child_age <= 8 then '6-8'
          when child_age <= 12 then '9-12'
          when child_age <= 15 then '13-15'
          when child_age <= 18 then '16-18'
          else '18+'
        end)
        from (
          select extract(year from age(current_date, make_date(ch.birth_year, coalesce(ch.birth_month, 7), 1)))::integer child_age
          from public.children ch where ch.family_id = c.id
        ) ages), '{}'::text[]) as age_ranges,
      exists (select 1 from public.family_cultures theirs join public.family_cultures ours on ours.culture_id = theirs.culture_id where theirs.family_id = c.id and ours.family_id = requester_family.id) as shares_culture,
      exists (select 1 from public.family_languages theirs join public.family_languages ours on ours.language_id = theirs.language_id where theirs.family_id = c.id and ours.family_id = requester_family.id) as shares_language
    from candidates c
  )
  select e.id,
    e.name,
    e.city || ' area',
    case
      when e.distance_km < 5 then '<5 km'
      when e.distance_km < 10 then '5-10 km'
      when e.distance_km < 20 then '10-20 km'
      when e.distance_km < 30 then '20-30 km'
      when e.distance_km < 50 then '30-50 km'
      else '50-100 km'
    end,
    e.age_ranges,
    e.culture_names,
    e.language_names,
    e.shared_interest_names,
    array_remove(array[
      case when e.shares_culture then 'shared_culture' end,
      case when e.shares_language then 'shared_language' end,
      case when cardinality(e.shared_interest_names) > 0 then 'shared_interests' end,
      'nearby'
    ], null)::text[]
  from enriched e
  order by e.distance_km, e.id
  limit p_limit offset p_offset;
end;
$$;

revoke all on function public.consume_geocoding_rate_limit(text, integer, integer) from public;
revoke all on function public.claim_geocoding_provider_slot() from public;
revoke all on function public.complete_family_onboarding_with_location(jsonb) from public;
revoke all on function public.set_family_location(text, integer) from public;
revoke all on function public.set_discovery_block(uuid, boolean) from public;
revoke all on function public.discover_families(integer, uuid[], uuid[], uuid[], integer, integer, integer, integer) from public;
grant execute on function public.consume_geocoding_rate_limit(text, integer, integer),
  public.claim_geocoding_provider_slot() to service_role;
grant execute on function public.complete_family_onboarding_with_location(jsonb),
  public.set_family_location(text, integer), public.set_discovery_block(uuid, boolean),
  public.discover_families(integer, uuid[], uuid[], uuid[], integer, integer, integer, integer) to authenticated;

insert into kinavela_private.schema_migrations(version)
values ('202608090003_location_discovery')
on conflict (version) do nothing;

notify pgrst, 'reload schema';
commit;
