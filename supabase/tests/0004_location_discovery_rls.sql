\set ON_ERROR_STOP on
begin;

do $$
declare
  table_name text;
  rls_enabled boolean;
  rls_forced boolean;
begin
  foreach table_name in array array[
    'geocoding_cache', 'geocoding_rate_limits',
    'geocoding_provider_state', 'discovery_blocks'
  ] loop
    select relrowsecurity, relforcerowsecurity into rls_enabled, rls_forced
    from pg_class where oid = format('public.%I', table_name)::regclass;
    if not rls_enabled or not rls_forced then
      raise exception 'RLS is not enabled and forced on public.%', table_name;
    end if;
  end loop;
  if has_table_privilege('anon', 'public.geocoding_cache', 'select')
     or has_table_privilege('authenticated', 'public.geocoding_cache', 'select') then
    raise exception 'Geocoding cache must not be directly readable.';
  end if;
  if has_function_privilege('anon', 'public.discover_families(integer,uuid[],uuid[],uuid[],integer,integer,integer,integer)', 'execute') then
    raise exception 'Anonymous users may execute discovery.';
  end if;
  if has_function_privilege('anon', 'public.set_family_location(text,integer)', 'execute')
     or has_function_privilege('anon', 'public.set_discovery_block(uuid,boolean)', 'execute')
     or has_function_privilege('anon', 'public.list_discovery_blocks()', 'execute')
     or has_function_privilege('authenticated', 'public.claim_geocoding_provider_slot()', 'execute')
     or has_function_privilege('authenticated', 'public.consume_geocoding_rate_limit(text,integer,integer)', 'execute') then
    raise exception 'Phase 3 RPC role grants exceed least privilege.';
  end if;
end
$$;

\set discovery_user_a 'eaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
\set discovery_user_b 'ebbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
\set discovery_user_c 'eccccccc-cccc-4ccc-8ccc-cccccccccccc'
\set discovery_user_d 'eddddddd-dddd-4ddd-8ddd-dddddddddddd'
\set discovery_family_a 'eaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
\set discovery_family_b 'ebbbbbbb-2222-4222-8222-bbbbbbbbbbbb'
\set discovery_family_c 'eccccccc-3333-4333-8333-cccccccccccc'

insert into auth.users(id, email, raw_user_meta_data, is_sso_user, is_anonymous, created_at, updated_at)
values
  (:'discovery_user_a', 'discovery-a@kinavela.invalid', '{"display_name":"Discovery A"}', false, false, now(), now()),
  (:'discovery_user_b', 'discovery-b@kinavela.invalid', '{"display_name":"Discovery B"}', false, false, now(), now()),
  (:'discovery_user_c', 'discovery-c@kinavela.invalid', '{"display_name":"Discovery C"}', false, false, now(), now());

select id as discovery_profile_a from public.profiles where auth_user_id = :'discovery_user_a'::uuid \gset
select id as discovery_profile_b from public.profiles where auth_user_id = :'discovery_user_b'::uuid \gset
select id as discovery_profile_c from public.profiles where auth_user_id = :'discovery_user_c'::uuid \gset

insert into public.families(id, name, slug, created_by, country_of_residence, city, location, discovery_radius_km)
values
  (:'discovery_family_a', 'Discovery Family A', 'discovery-family-a', :'discovery_profile_a', 'DE', 'Berlin', extensions.st_setsrid(extensions.st_makepoint(13.4050, 52.5200), 4326)::extensions.geography, 40),
  (:'discovery_family_b', 'Discovery Family B', 'discovery-family-b', :'discovery_profile_b', 'DE', 'Potsdam', extensions.st_setsrid(extensions.st_makepoint(13.3000, 52.5000), 4326)::extensions.geography, 40),
  (:'discovery_family_c', 'Discovery Family C', 'discovery-family-c', :'discovery_profile_c', 'DE', 'Munich', extensions.st_setsrid(extensions.st_makepoint(11.5820, 48.1351), 4326)::extensions.geography, 40);

insert into public.family_members(family_id, profile_id, role, status)
values
  (:'discovery_family_a', :'discovery_profile_a', 'owner', 'active'),
  (:'discovery_family_b', :'discovery_profile_b', 'owner', 'active'),
  (:'discovery_family_c', :'discovery_profile_c', 'owner', 'active');

insert into public.children(family_id, nickname, birth_year)
values
  (:'discovery_family_a', 'Private A', 2020),
  (:'discovery_family_b', 'Private B', 2019),
  (:'discovery_family_c', 'Private C', 2018);

insert into public.family_cultures(family_id, culture_id, relationship_type)
values
  (:'discovery_family_a', '20000000-0000-4000-8000-000000000001', 'origin'),
  (:'discovery_family_b', '20000000-0000-4000-8000-000000000001', 'origin');
insert into public.family_languages(family_id, language_id, proficiency, transmission_goal)
values
  (:'discovery_family_a', '30000000-0000-4000-8000-000000000003', 'fluent', 'already_speaking'),
  (:'discovery_family_b', '30000000-0000-4000-8000-000000000003', 'fluent', 'already_speaking');
insert into public.family_interests(family_id, interest_id)
values
  (:'discovery_family_a', '40000000-0000-4000-8000-000000000001'),
  (:'discovery_family_b', '40000000-0000-4000-8000-000000000001');

select set_config('request.jwt.claim.sub', :'discovery_user_a', true);
select set_config('request.jwt.claims', json_build_object('sub', :'discovery_user_a', 'role', 'authenticated')::text, true);
set local role authenticated;

select count(*)::integer as nearby_count
from public.discover_families(40, null, null, null, null, null, 30, 0)
where family_id = :'discovery_family_b'::uuid
  and distance_bucket in ('5-10 km', '10-20 km')
  and 'shared_culture' = any(compatibility_reasons)
  and 'shared_language' = any(compatibility_reasons)
  and 'playdates' = any(shared_interests) \gset
select count(*)::integer as far_count
from public.discover_families(40, null, null, null, null, null, 30, 0)
where family_id = :'discovery_family_c'::uuid \gset

\if :nearby_count
\else
  \echo 'Discovery failure: nearby compatible family was not returned safely.'
  \quit 1
\endif
\if :far_count
  \echo 'Discovery failure: family outside the radius was returned.'
  \quit 1
\endif

select public.set_discovery_block(:'discovery_family_b'::uuid, true);
select count(*)::integer as block_list_count
from public.list_discovery_blocks()
where family_id = :'discovery_family_b'::uuid and family_name = 'Discovery Family B' \gset
\if :block_list_count
\else
  \echo 'Discovery failure: owner cannot manage its blocked-family list.'
  \quit 1
\endif
select count(*)::integer as blocked_count
from public.discover_families(40, null, null, null, null, null, 30, 0)
where family_id = :'discovery_family_b'::uuid \gset
\if :blocked_count
  \echo 'Discovery failure: blocked family remains visible.'
  \quit 1
\endif

reset role;
select set_config('request.jwt.claim.sub', :'discovery_user_b', true);
select set_config('request.jwt.claims', json_build_object('sub', :'discovery_user_b', 'role', 'authenticated')::text, true);
set local role authenticated;
select count(*)::integer as reverse_block_count
from public.discover_families(40, null, null, null, null, null, 30, 0)
where family_id = :'discovery_family_a'::uuid \gset
\if :reverse_block_count
  \echo 'Discovery failure: blocker remains visible to blocked family.'
  \quit 1
\endif

reset role;
insert into public.geocoding_cache(query_hash, provider_place_id, display_city, display_area, country_code, location)
values (repeat('a', 64), 'test:berlin', 'Berlin', 'Berlin', 'DE', extensions.st_setsrid(extensions.st_makepoint(13.4050, 52.5200), 4326)::extensions.geography);
select set_config('request.jwt.claim.sub', :'discovery_user_a', true);
select set_config('request.jwt.claims', json_build_object('sub', :'discovery_user_a', 'role', 'authenticated')::text, true);
set local role authenticated;
select public.set_family_location('test:berlin', 30);

reset role;
insert into auth.users(id, email, raw_user_meta_data, is_sso_user, is_anonymous, email_confirmed_at, created_at, updated_at)
values (:'discovery_user_d', 'discovery-onboarding@kinavela.invalid', '{"display_name":"Discovery Onboarding"}', false, false, now(), now(), now());
select set_config('request.jwt.claim.sub', :'discovery_user_d', true);
select set_config('request.jwt.claims', json_build_object('sub', :'discovery_user_d', 'role', 'authenticated')::text, true);
set local role authenticated;
select public.complete_family_onboarding_with_location($json$
{
  "display_name":"Discovery Onboarding",
  "preferred_language":"en",
  "timezone":"Europe/Berlin",
  "family":{"name":"Located Onboarding Family","country_of_residence":"DE","city":"Berlin","location_place_id":"test:berlin","radius_km":30,"visibility":"discoverable","bio":""},
  "children":[{"nickname":"Little Root","birth_year":2020,"birth_month":null,"gender":null}],
  "culture_ids":["20000000-0000-4000-8000-000000000001"],
  "languages":[{"language_id":"30000000-0000-4000-8000-000000000003","proficiency":"fluent","transmission_goal":"want_to_teach_children"}],
  "preservation_goals":["language"],
  "interest_ids":["40000000-0000-4000-8000-000000000001"],
  "availability":[{"weekday":6,"period":"afternoon"}],
  "preferences":{"open_to_other_african_families":true,"open_to_all_diaspora_families":false,"min_child_age":0,"max_child_age":12}
}
$json$::jsonb) as located_family_id \gset
select count(*)::integer as located_onboarding_count
from public.families
where id = :'located_family_id'::uuid and location is not null and city = 'Berlin' \gset
\if :located_onboarding_count
\else
  \echo 'Location failure: onboarding did not atomically store the cached city location.'
  \quit 1
\endif

reset role;
rollback;
