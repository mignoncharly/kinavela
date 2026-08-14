\set ON_ERROR_STOP on
begin;

do $$
begin
  if to_regprocedure('kinavela_private.enforce_pilot_location(text,text)') is not null
     or to_regprocedure('kinavela_private.enforce_pilot_family_limit()') is not null then
    raise exception 'legacy pilot enforcement functions still exist';
  end if;
  if exists (
    select 1
    from pg_trigger
    where tgname = 'families_enforce_pilot_limit'
      and not tgisinternal
  ) then
    raise exception 'legacy family admission trigger still exists';
  end if;
  if to_regprocedure('public.admin_set_pilot_region_status(text,text,text)') is not null then
    raise exception 'pilot region status mutator still exists';
  end if;
  if has_function_privilege(
    'authenticated',
    'public.complete_family_onboarding(jsonb)',
    'execute'
  ) then
    raise exception 'non-geocoded onboarding RPC is still exposed';
  end if;
end
$$;

\set phase_a_user_a 'eaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
\set phase_a_user_b 'ebbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
\set phase_a_user_c 'eccccccc-cccc-4ccc-8ccc-cccccccccccc'
\set phase_a_family_a 'eaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'

insert into auth.users(
  id,
  email,
  raw_user_meta_data,
  is_sso_user,
  is_anonymous,
  email_confirmed_at,
  created_at,
  updated_at
)
values
  (:'phase_a_user_a', 'phase-a-location@kinavela.invalid', '{"display_name":"Phase A Location"}', false, false, now(), now(), now()),
  (:'phase_a_user_b', 'phase-a-municipality@kinavela.invalid', '{"display_name":"Phase A Municipality"}', false, false, now(), now(), now()),
  (:'phase_a_user_c', 'phase-a-postcode@kinavela.invalid', '{"display_name":"Phase A Postcode"}', false, false, now(), now(), now());

select id as phase_a_profile_a
from public.profiles
where auth_user_id = :'phase_a_user_a'::uuid \gset

insert into public.families(
  id,
  name,
  slug,
  created_by,
  country_of_residence,
  city,
  location,
  discovery_radius_km
)
values (
  :'phase_a_family_a',
  'Phase A Location Family',
  'phase-a-location-family',
  :'phase_a_profile_a',
  'DE',
  'Berlin',
  extensions.st_setsrid(extensions.st_makepoint(13.4050, 52.5200), 4326)::extensions.geography,
  30
);

insert into public.family_members(family_id, profile_id, role, status)
values (:'phase_a_family_a', :'phase_a_profile_a', 'owner', 'active');

insert into auth.users(
  id,
  email,
  raw_user_meta_data,
  is_sso_user,
  is_anonymous,
  email_confirmed_at,
  created_at,
  updated_at
)
select
  lpad(to_hex(series), 32, '0')::uuid,
  format('phase-a-cap-%s@kinavela.invalid', series),
  jsonb_build_object('display_name', format('Cap fixture %s', series)),
  false,
  false,
  now(),
  now(),
  now()
from generate_series(1, 20) series;

insert into public.families(
  id,
  name,
  slug,
  created_by,
  country_of_residence,
  city,
  location,
  discovery_radius_km
)
select
  lpad(to_hex(series + 100), 32, '0')::uuid,
  format('Cap fixture family %s', series),
  format('phase-a-cap-family-%s', series),
  profile.id,
  'DE',
  'Ingolstadt',
  extensions.st_setsrid(extensions.st_makepoint(11.4257, 48.7665), 4326)::extensions.geography,
  30
from generate_series(1, 20) series
join public.profiles profile
  on profile.auth_user_id = lpad(to_hex(series), 32, '0')::uuid;

insert into public.geocoding_cache(
  query_hash,
  provider_place_id,
  display_city,
  display_area,
  country_code,
  location
)
values
  (repeat('a', 64), 'phase-a-paris', 'Paris', 'Île-de-France', 'FR', extensions.st_setsrid(extensions.st_makepoint(2.3522, 48.8566), 4326)::extensions.geography),
  (repeat('b', 64), 'phase-a-aresing', 'Aresing', 'Bavaria', 'DE', extensions.st_setsrid(extensions.st_makepoint(11.3000, 48.5333), 4326)::extensions.geography),
  (repeat('c', 64), 'phase-a-schrobenhausen', 'Schrobenhausen', 'Bavaria', 'DE', extensions.st_setsrid(extensions.st_makepoint(11.2612, 48.5607), 4326)::extensions.geography),
  (repeat('d', 64), 'phase-a-postcode-85123', 'Karlskron', 'Bavaria', 'DE', extensions.st_setsrid(extensions.st_makepoint(11.4156, 48.6786), 4326)::extensions.geography);

update kinavela_private.pilot_settings
set enabled = true,
    max_active_families = 20,
    density_threshold = 100,
    updated_at = now()
where id = true;

insert into kinavela_private.pilot_regions(country_code, city, status, threshold)
values ('DE', 'Aresing', 'paused', 100)
on conflict (country_code, city)
do update set status = 'paused', threshold = 100, updated_at = now();

select set_config('request.jwt.claim.sub', :'phase_a_user_a', true);
select set_config(
  'request.jwt.claims',
  json_build_object('sub', :'phase_a_user_a', 'role', 'authenticated')::text,
  true
);
set local role authenticated;

do $$
begin
  perform public.set_family_location('phase-a-aresing', 35);
  perform public.set_family_location('phase-a-schrobenhausen', 45);

  begin
    perform public.set_family_location('phase-a-paris', 30);
    raise exception 'expected germany_location_required';
  exception when others then
    if sqlerrm <> 'germany_location_required' then raise; end if;
  end;
end
$$;

do $$
begin
  if not exists (
    select 1
    from public.families
    where id = 'eaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
      and city = 'Schrobenhausen'
      and discovery_radius_km = 45
  ) then
    raise exception 'location change between arbitrary German cities failed';
  end if;
end
$$;

reset role;
select set_config('request.jwt.claim.sub', :'phase_a_user_b', true);
select set_config(
  'request.jwt.claims',
  json_build_object('sub', :'phase_a_user_b', 'role', 'authenticated')::text,
  true
);
set local role authenticated;

select public.complete_family_onboarding_with_location($json$
{
  "display_name":"Phase A Municipality",
  "preferred_language":"en",
  "timezone":"Europe/Berlin",
  "family":{"name":"Aresing Family","country_of_residence":"DE","city":"Aresing","location_place_id":"phase-a-aresing","radius_km":30,"visibility":"discoverable","bio":""},
  "children":[{"nickname":"Little Root","birth_year":2020,"birth_month":null,"gender":null}],
  "culture_ids":["20000000-0000-4000-8000-000000000001"],
  "languages":[{"language_id":"30000000-0000-4000-8000-000000000003","proficiency":"fluent","transmission_goal":"want_to_teach_children"}],
  "preservation_goals":["language"],
  "interest_ids":["40000000-0000-4000-8000-000000000001"],
  "availability":[{"weekday":6,"period":"afternoon"}],
  "preferences":{"open_to_other_african_families":true,"open_to_all_diaspora_families":false,"min_child_age":0,"max_child_age":12}
}
$json$::jsonb);

reset role;
select set_config('request.jwt.claim.sub', :'phase_a_user_c', true);
select set_config(
  'request.jwt.claims',
  json_build_object('sub', :'phase_a_user_c', 'role', 'authenticated')::text,
  true
);
set local role authenticated;

select public.complete_family_onboarding_with_location($json$
{
  "display_name":"Phase A Postcode",
  "preferred_language":"en",
  "timezone":"Europe/Berlin",
  "family":{"name":"Karlskron Family","country_of_residence":"DE","city":"85123","location_place_id":"phase-a-postcode-85123","radius_km":30,"visibility":"discoverable","bio":""},
  "children":[{"nickname":"Little Root","birth_year":2021,"birth_month":null,"gender":null}],
  "culture_ids":["20000000-0000-4000-8000-000000000001"],
  "languages":[{"language_id":"30000000-0000-4000-8000-000000000003","proficiency":"fluent","transmission_goal":"want_to_teach_children"}],
  "preservation_goals":["language"],
  "interest_ids":["40000000-0000-4000-8000-000000000001"],
  "availability":[{"weekday":6,"period":"afternoon"}],
  "preferences":{"open_to_other_african_families":true,"open_to_all_diaspora_families":false,"min_child_age":0,"max_child_age":12}
}
$json$::jsonb);

do $$
begin
  if not exists (
    select 1
    from public.families family
    join public.profiles profile on profile.id = family.created_by
    where profile.auth_user_id = 'eccccccc-cccc-4ccc-8ccc-cccccccccccc'
      and family.city = 'Karlskron'
      and family.country_of_residence = 'DE'
  ) then
    raise exception 'German postcode onboarding failed';
  end if;
end
$$;

reset role;
rollback;
