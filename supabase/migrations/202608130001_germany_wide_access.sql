begin;

-- Germany is the launch-country boundary, but admission is no longer controlled
-- by a city allowlist, a regional status, density, or an active-family cap.
drop trigger if exists families_enforce_pilot_limit on public.families;
drop function if exists kinavela_private.enforce_pilot_family_limit();
drop function if exists kinavela_private.enforce_pilot_location(text, text);

update kinavela_private.pilot_settings
set enabled = false,
    updated_at = now()
where id = true;

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
  effective_payload jsonb;
begin
  if place_id is null or char_length(place_id) not between 3 and 160 then
    raise exception 'invalid_location';
  end if;

  select * into cached_place
  from public.geocoding_cache
  where provider_place_id = place_id
    and expires_at > now();
  if not found then
    raise exception 'invalid_location';
  end if;
  if upper(cached_place.country_code) <> 'DE' then
    raise exception 'germany_location_required';
  end if;

  effective_payload := jsonb_set(
    jsonb_set(
      p_payload,
      '{family,country_of_residence}',
      '"DE"'::jsonb,
      true
    ),
    '{family,city}',
    to_jsonb(cached_place.display_city),
    true
  );

  family_uuid := public.complete_family_onboarding(effective_payload);

  update public.families
  set city = cached_place.display_city,
      country_of_residence = 'DE',
      location = cached_place.location,
      location_precision = 'city',
      updated_at = now()
  where id = family_uuid;

  update public.profiles
  set city = cached_place.display_city,
      country_of_residence = 'DE',
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
  where fm.profile_id = profile_uuid
    and fm.role = 'owner'
    and fm.status = 'active'
  order by fm.created_at
  limit 1;
  if family_uuid is null then raise exception 'not_authorized'; end if;

  select * into cached_place
  from public.geocoding_cache
  where provider_place_id = trim(p_provider_place_id)
    and expires_at > now();
  if not found then raise exception 'invalid_location'; end if;
  if upper(cached_place.country_code) <> 'DE' then
    raise exception 'germany_location_required';
  end if;

  update public.families
  set city = cached_place.display_city,
      country_of_residence = 'DE',
      location = cached_place.location,
      location_precision = 'city',
      discovery_radius_km = p_radius_km,
      updated_at = now()
  where id = family_uuid;

  update public.discovery_preferences
  set radius_km = p_radius_km,
      updated_at = now()
  where family_id = family_uuid;

  update public.profiles
  set city = cached_place.display_city,
      country_of_residence = 'DE',
      updated_at = now()
  where id = profile_uuid;

  insert into public.audit_events(
    actor_profile_id,
    event_type,
    entity_type,
    entity_id,
    metadata
  )
  values (
    profile_uuid,
    'privacy_setting_changed',
    'family',
    family_uuid,
    '{"setting":"approximate_location"}'::jsonb
  );
  return family_uuid;
end;
$$;

-- Regional records remain available for historical export and outreach
-- analytics. They have no admission semantics and cannot be mutated via RPC.
drop function if exists public.admin_set_pilot_region_status(text, text, text);

create or replace function public.admin_list_regional_density()
returns table(
  country_code text,
  city text,
  waiting_count bigint,
  family_count bigint,
  threshold integer,
  rollout_status text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not kinavela_private.is_admin(public.current_profile_id()) then
    raise exception 'admin_required';
  end if;

  return query
  with locations as (
    select
      kinavela_private.pilot_city_key(family.city) as city_key,
      family.city
    from public.families family
    where family.country_of_residence = 'DE'
    union
    select
      kinavela_private.pilot_city_key(waitlist.city) as city_key,
      waitlist.city
    from public.pilot_waitlist waitlist
    where waitlist.country_code = 'DE'
    union
    select
      kinavela_private.pilot_city_key(region.city) as city_key,
      region.city
    from kinavela_private.pilot_regions region
    where region.country_code = 'DE'
  ),
  regions as (
    select location.city_key, min(location.city) as city
    from locations location
    group by location.city_key
  )
  select
    'DE'::text,
    region.city,
    (
      select count(*)
      from public.pilot_waitlist waitlist
      where waitlist.country_code = 'DE'
        and kinavela_private.pilot_city_key(waitlist.city) = region.city_key
        and waitlist.status in ('waiting', 'invited')
    ),
    (
      select count(*)
      from public.families family
      join public.profiles profile on profile.id = family.created_by
      where family.country_of_residence = 'DE'
        and kinavela_private.pilot_city_key(family.city) = region.city_key
        and family.visibility = 'discoverable'
        and profile.status = 'active'
    ),
    coalesce(
      (select settings.density_threshold
       from kinavela_private.pilot_settings settings
       where settings.id = true),
      10
    ),
    'available'::text
  from regions region
  order by region.city;
end;
$$;

-- The location-aware wrapper is the only onboarding RPC exposed to families.
revoke execute on function public.complete_family_onboarding(jsonb)
  from authenticated;
revoke all on function public.join_pilot_waitlist(text, text, text),
  public.list_my_pilot_waitlist()
  from public, anon, authenticated;
revoke all on function public.admin_list_regional_density()
  from public, anon, authenticated, service_role;
grant execute on function public.admin_list_regional_density()
  to authenticated;

comment on table public.pilot_waitlist is
  'Historical pilot waitlist retained temporarily for restricted audit and export; it does not control access.';
comment on table kinavela_private.pilot_regions is
  'Historical pilot regions retained for analytics only; status does not control access.';

insert into kinavela_private.schema_migrations(version)
values ('202608130001_germany_wide_access')
on conflict (version) do nothing;

notify pgrst, 'reload schema';
commit;
