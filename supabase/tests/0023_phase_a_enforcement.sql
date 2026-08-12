\set ON_ERROR_STOP on
begin;

do $$
begin
  if to_regprocedure('kinavela_private.enforce_pilot_location(text,text)') is null
     or to_regprocedure('public.complete_family_onboarding_with_location(jsonb)') is null
     or to_regprocedure('public.set_family_location(text,integer)') is null then
    raise exception 'Phase A pilot enforcement functions are missing';
  end if;
end
$$;

\set phase_a_user_a 'eaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
\set phase_a_user_b 'ebbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
\set phase_a_family_a 'eaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'

insert into auth.users(id, email, raw_user_meta_data, is_sso_user, is_anonymous, email_confirmed_at, created_at, updated_at)
values
  (:'phase_a_user_a', 'phase-a-location@kinavela.invalid', '{"display_name":"Phase A Location"}', false, false, now(), now(), now()),
  (:'phase_a_user_b', 'phase-a-onboarding@kinavela.invalid', '{"display_name":"Phase A Onboarding"}', false, false, now(), now(), now());

select id as phase_a_profile_a from public.profiles where auth_user_id = :'phase_a_user_a'::uuid \gset

insert into public.families(
  id, name, slug, created_by, country_of_residence, city, location, discovery_radius_km
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

insert into public.geocoding_cache(query_hash, provider_place_id, display_city, display_area, country_code, location)
values
  (repeat('a', 64), 'phase-a-paris', 'Paris', 'Île-de-France', 'FR', extensions.st_setsrid(extensions.st_makepoint(2.3522, 48.8566), 4326)::extensions.geography),
  (repeat('b', 64), 'phase-a-berlin', 'Berlin', 'Berlin', 'DE', extensions.st_setsrid(extensions.st_makepoint(13.4050, 52.5200), 4326)::extensions.geography),
  (repeat('c', 64), 'phase-a-cologne', 'Cologne', 'North Rhine-Westphalia', 'DE', extensions.st_setsrid(extensions.st_makepoint(6.9603, 50.9375), 4326)::extensions.geography),
  (repeat('d', 64), 'phase-a-munich', 'München', 'Bavaria', 'DE', extensions.st_setsrid(extensions.st_makepoint(11.5820, 48.1351), 4326)::extensions.geography);

update kinavela_private.pilot_regions
set status = 'paused', updated_at = now()
where country_code = 'DE' and city = 'Berlin';

select set_config('request.jwt.claim.sub', :'phase_a_user_a', true);
select set_config('request.jwt.claims', json_build_object('sub', :'phase_a_user_a', 'role', 'authenticated')::text, true);
set local role authenticated;

do $$
begin
  begin
    perform public.set_family_location('phase-a-paris', 30);
    raise exception 'expected pilot_country_closed';
  exception when others then
    if sqlerrm <> 'pilot_country_closed' then raise; end if;
  end;

  begin
    perform public.set_family_location('phase-a-berlin', 30);
    raise exception 'expected pilot_region_closed';
  exception when others then
    if sqlerrm <> 'pilot_region_closed' then raise; end if;
  end;

  perform public.set_family_location('phase-a-munich', 30);
end
$$;

reset role;
select set_config('request.jwt.claim.sub', :'phase_a_user_b', true);
select set_config('request.jwt.claims', json_build_object('sub', :'phase_a_user_b', 'role', 'authenticated')::text, true);
set local role authenticated;

do $$
begin
  begin
    perform public.complete_family_onboarding_with_location($json$
    {
      "display_name":"Phase A Onboarding",
      "preferred_language":"en",
      "timezone":"Europe/Berlin",
      "family":{"name":"Closed Region Family","country_of_residence":"DE","city":"Cologne","location_place_id":"phase-a-cologne","radius_km":30,"visibility":"discoverable","bio":""},
      "children":[{"nickname":"Little Root","birth_year":2020,"birth_month":null,"gender":null}],
      "culture_ids":["20000000-0000-4000-8000-000000000001"],
      "languages":[{"language_id":"30000000-0000-4000-8000-000000000003","proficiency":"fluent","transmission_goal":"want_to_teach_children"}],
      "preservation_goals":["language"],
      "interest_ids":["40000000-0000-4000-8000-000000000001"],
      "availability":[{"weekday":6,"period":"afternoon"}],
      "preferences":{"open_to_other_african_families":true,"open_to_all_diaspora_families":false,"min_child_age":0,"max_child_age":12}
    }
    $json$::jsonb);
    raise exception 'expected pilot_region_closed';
  exception when others then
    if sqlerrm <> 'pilot_region_closed' then raise; end if;
  end;
end
$$;

reset role;
rollback;
