begin;

create or replace function kinavela_private.pilot_city_key(p_city text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select regexp_replace(
    translate(lower(btrim(p_city)), 'äöüß', 'aous'),
    '[^a-z0-9]+',
    '',
    'g'
  );
$$;

create or replace function kinavela_private.enforce_pilot_location(
  p_country_code text,
  p_city text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  settings kinavela_private.pilot_settings%rowtype;
begin
  select * into settings
  from kinavela_private.pilot_settings
  where id = true;

  if coalesce(settings.enabled, false) then
    if not (upper(p_country_code) = any(settings.allowed_country_codes)) then
      raise exception 'pilot_country_closed';
    end if;

    if upper(p_country_code) = 'DE' and not exists (
      select 1
      from kinavela_private.pilot_regions region
      where region.country_code = 'DE'
        and region.status = 'open'
        and kinavela_private.pilot_city_key(region.city) = kinavela_private.pilot_city_key(p_city)
    ) then
      raise exception 'pilot_region_closed';
    end if;
  end if;
end;
$$;

create or replace function kinavela_private.enforce_pilot_family_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  settings kinavela_private.pilot_settings%rowtype;
  active_families integer;
begin
  if auth.uid() is null or not exists (
    select 1
    from public.profiles
    where id = new.created_by and auth_user_id = auth.uid()
  ) then
    return new;
  end if;

  perform kinavela_private.enforce_pilot_location(
    new.country_of_residence,
    new.city
  );

  select * into settings
  from kinavela_private.pilot_settings
  where id = true;

  if coalesce(settings.enabled, false) then
    perform pg_advisory_xact_lock(hashtextextended('kinavela-pilot-family-cap', 0));
    select count(*)::integer into active_families
    from public.families family
    join public.profiles profile on profile.id = family.created_by
    where profile.status = 'active'
      and family.country_of_residence = any(settings.allowed_country_codes);
    if active_families >= settings.max_active_families then
      raise exception 'pilot_capacity_reached';
    end if;
  end if;
  return new;
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
  effective_payload jsonb;
begin
  if place_id is null or char_length(place_id) not between 3 and 160 then
    raise exception 'invalid_location';
  end if;

  select * into cached_place
  from public.geocoding_cache
  where provider_place_id = place_id and expires_at > now();
  if not found then raise exception 'invalid_location'; end if;

  effective_payload := jsonb_set(
    jsonb_set(
      p_payload,
      '{family,country_of_residence}',
      to_jsonb(upper(cached_place.country_code)),
      true
    ),
    '{family,city}',
    to_jsonb(cached_place.display_city),
    true
  );

  family_uuid := public.complete_family_onboarding(effective_payload);

  update public.families
  set city = cached_place.display_city,
      country_of_residence = upper(cached_place.country_code),
      location = cached_place.location,
      location_precision = 'city',
      updated_at = now()
  where id = family_uuid;

  update public.profiles
  set city = cached_place.display_city,
      country_of_residence = upper(cached_place.country_code),
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

  perform kinavela_private.enforce_pilot_location(
    cached_place.country_code,
    cached_place.display_city
  );

  update public.families
  set city = cached_place.display_city,
      country_of_residence = upper(cached_place.country_code),
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
      country_of_residence = upper(cached_place.country_code),
      updated_at = now()
  where id = profile_uuid;

  insert into public.audit_events(actor_profile_id, event_type, entity_type, entity_id, metadata)
  values (profile_uuid, 'privacy_setting_changed', 'family', family_uuid, '{"setting":"approximate_location"}'::jsonb);
  return family_uuid;
end;
$$;

create or replace function public.admin_set_pilot_region_status(p_country_code text, p_city text, p_status text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_uuid uuid := public.current_profile_id();
begin
  if not kinavela_private.is_admin(actor_uuid) then raise exception 'admin_required'; end if;
  if upper(p_country_code) <> 'DE'
     or char_length(btrim(coalesce(p_city, ''))) not between 2 and 120
     or p_status not in ('waitlist','open','paused') then
    raise exception 'invalid_pilot_region';
  end if;
  update kinavela_private.pilot_regions
  set status = p_status, updated_at = now()
  where country_code = 'DE'
    and kinavela_private.pilot_city_key(city) = kinavela_private.pilot_city_key(p_city);
  if not found then raise exception 'pilot_region_not_found'; end if;
  insert into public.audit_events(actor_profile_id, event_type, entity_type, metadata)
  values (actor_uuid, 'pilot_region_status_changed', 'pilot_region',
    jsonb_build_object('country_code','DE','city',btrim(p_city),'status',p_status));
  return true;
end;
$$;

create or replace function public.admin_list_regional_density()
returns table(country_code text, city text, waiting_count bigint, family_count bigint, threshold integer, rollout_status text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not kinavela_private.is_admin(public.current_profile_id()) then raise exception 'admin_required'; end if;
  return query
  select region.country_code,
    region.city,
    (select count(*)
     from public.pilot_waitlist waitlist
     where waitlist.country_code = region.country_code
       and kinavela_private.pilot_city_key(waitlist.city) = kinavela_private.pilot_city_key(region.city)
       and waitlist.status in ('waiting','invited')),
    (select count(*)
     from public.families family
     join public.profiles profile on profile.id = family.created_by
     where family.country_of_residence = region.country_code
       and kinavela_private.pilot_city_key(family.city) = kinavela_private.pilot_city_key(region.city)
       and family.visibility = 'discoverable'
       and profile.status = 'active'),
    region.threshold,
    region.status
  from kinavela_private.pilot_regions region
  order by region.country_code, region.city;
end;
$$;

revoke all on function kinavela_private.pilot_city_key(text), kinavela_private.enforce_pilot_location(text,text) from public, anon, authenticated, service_role;
revoke all on function public.admin_set_pilot_region_status(text,text,text), public.admin_list_regional_density() from public, anon, authenticated, service_role;
grant execute on function public.admin_set_pilot_region_status(text,text,text), public.admin_list_regional_density() to authenticated;

insert into kinavela_private.schema_migrations(version)
values ('202608110020_phase_a_pilot_enforcement')
on conflict (version) do nothing;
notify pgrst, 'reload schema';
commit;
