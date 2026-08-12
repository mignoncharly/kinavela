\set ON_ERROR_STOP on
begin;

do $$
begin
  if has_function_privilege('anon', 'public.match_families(integer,text,uuid[],uuid[],uuid[],integer,integer,integer,text,integer,integer)', 'execute') then
    raise exception 'Anonymous users may execute matching.';
  end if;
  if has_function_privilege('authenticated', 'kinavela_private.calculate_family_match(uuid,uuid,numeric,integer)', 'execute') then
    raise exception 'Authenticated users may execute the internal scorer directly.';
  end if;
  if has_function_privilege('authenticated', 'kinavela_private.calculate_family_match(uuid,uuid,double precision,integer)', 'execute') then
    raise exception 'Authenticated users may execute the internal distance scorer directly.';
  end if;
  if pg_get_function_result('public.match_families(integer,text,uuid[],uuid[],uuid[],integer,integer,integer,text,integer,integer)'::regprocedure)
     ~* '(longitude|latitude|nickname|birth_year|postcode|contact)' then
    raise exception 'Matching return type exposes a sensitive field.';
  end if;
end
$$;

\set match_user_a 'faaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
\set match_user_b 'fbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
\set match_user_c 'fccccccc-cccc-4ccc-8ccc-cccccccccccc'
\set match_user_d 'fddddddd-dddd-4ddd-8ddd-dddddddddddd'
\set match_family_a 'faaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
\set match_family_b 'fbbbbbbb-2222-4222-8222-bbbbbbbbbbbb'
\set match_family_c 'fccccccc-3333-4333-8333-cccccccccccc'
\set match_family_d 'fddddddd-4444-4444-8444-dddddddddddd'

insert into auth.users(id, email, raw_user_meta_data, is_sso_user, is_anonymous, created_at, updated_at)
values
  (:'match_user_a', 'match-a@kinavela.invalid', '{"display_name":"Match A"}', false, false, now(), now()),
  (:'match_user_b', 'match-b@kinavela.invalid', '{"display_name":"Match B"}', false, false, now(), now()),
  (:'match_user_c', 'match-c@kinavela.invalid', '{"display_name":"Match C"}', false, false, now(), now()),
  (:'match_user_d', 'match-d@kinavela.invalid', '{"display_name":"Match D"}', false, false, now(), now());

select id as match_profile_a from public.profiles where auth_user_id = :'match_user_a'::uuid \gset
select id as match_profile_b from public.profiles where auth_user_id = :'match_user_b'::uuid \gset
select id as match_profile_c from public.profiles where auth_user_id = :'match_user_c'::uuid \gset
select id as match_profile_d from public.profiles where auth_user_id = :'match_user_d'::uuid \gset

insert into public.families(id, name, slug, created_by, country_of_residence, city, location, discovery_radius_km)
values
  (:'match_family_a', 'Match Family A', 'match-family-a', :'match_profile_a', 'DE', 'Berlin', extensions.st_setsrid(extensions.st_makepoint(13.4050, 52.5200), 4326)::extensions.geography, 40),
  (:'match_family_b', 'Match Family B', 'match-family-b', :'match_profile_b', 'DE', 'Potsdam', extensions.st_setsrid(extensions.st_makepoint(13.3000, 52.5000), 4326)::extensions.geography, 40),
  (:'match_family_c', 'Match Family C', 'match-family-c', :'match_profile_c', 'CM', 'Nearby area', extensions.st_setsrid(extensions.st_makepoint(13.4100, 52.5200), 4326)::extensions.geography, 40),
  (:'match_family_d', 'Match Family D', 'match-family-d', :'match_profile_d', 'DE', 'Potsdam', extensions.st_setsrid(extensions.st_makepoint(13.3000, 52.5000), 4326)::extensions.geography, 40);

insert into public.family_members(family_id, profile_id, role, status)
values
  (:'match_family_a', :'match_profile_a', 'owner', 'active'),
  (:'match_family_b', :'match_profile_b', 'owner', 'active'),
  (:'match_family_c', :'match_profile_c', 'owner', 'active'),
  (:'match_family_d', :'match_profile_d', 'owner', 'active');
insert into public.children(family_id, nickname, birth_year, birth_month)
values
  (:'match_family_a', 'Private A', 2020, 6),
  (:'match_family_b', 'Private B', 2020, 6),
  (:'match_family_c', 'Private C', 2012, 6),
  (:'match_family_d', 'Private D', 2020, 6);
insert into public.discovery_preferences(family_id)
values (:'match_family_a'), (:'match_family_b'), (:'match_family_c'), (:'match_family_d');

insert into public.family_cultures(family_id, culture_id, relationship_type)
values
  (:'match_family_a', '20000000-0000-4000-8000-000000000001', 'origin'),
  (:'match_family_b', '20000000-0000-4000-8000-000000000001', 'origin'),
  (:'match_family_c', '20000000-0000-4000-8000-000000000006', 'origin'),
  (:'match_family_d', '20000000-0000-4000-8000-000000000001', 'origin');
insert into public.family_languages(family_id, language_id, proficiency, transmission_goal)
values
  (:'match_family_a', '30000000-0000-4000-8000-000000000003', 'fluent', 'already_speaking'),
  (:'match_family_b', '30000000-0000-4000-8000-000000000003', 'fluent', 'already_speaking'),
  (:'match_family_c', '30000000-0000-4000-8000-000000000001', 'fluent', 'already_speaking'),
  (:'match_family_d', '30000000-0000-4000-8000-000000000003', 'fluent', 'already_speaking');
insert into public.family_interests(family_id, interest_id)
values
  (:'match_family_a', '40000000-0000-4000-8000-000000000001'),
  (:'match_family_b', '40000000-0000-4000-8000-000000000001'),
  (:'match_family_c', '40000000-0000-4000-8000-000000000003'),
  (:'match_family_d', '40000000-0000-4000-8000-000000000001');
insert into public.family_availability(family_id, weekday, period)
values
  (:'match_family_a', 6, 'afternoon'),
  (:'match_family_b', 6, 'afternoon'),
  (:'match_family_c', 5, 'morning'),
  (:'match_family_d', 6, 'afternoon');

select set_config('request.jwt.claim.sub', :'match_user_a', true);
select set_config('request.jwt.claims', json_build_object('sub', :'match_user_a', 'role', 'authenticated')::text, true);
set local role authenticated;

select md5(coalesce(jsonb_agg(to_jsonb(result) order by result.match_score desc, result.family_id)::text, '')) as first_hash
from public.match_families(40, null, null, null, null, null, null, null, null, 30, 0) result \gset
select md5(coalesce(jsonb_agg(to_jsonb(result) order by result.match_score desc, result.family_id)::text, '')) as second_hash
from public.match_families(40, null, null, null, null, null, null, null, null, 30, 0) result \gset
select (:'first_hash' = :'second_hash')::integer as deterministic_count \gset
\if :deterministic_count
\else
  \echo 'Matching failure: identical inputs did not produce identical output.'
  \quit 1
\endif

select count(*)::integer as score_bounds_count
from public.match_families(40, null, null, null, null, null, null, null, null, 30, 0)
where match_score between 0 and 100 \gset
select (:score_bounds_count = 3)::integer as score_bounds_valid \gset
\if :score_bounds_valid
\else
  \echo 'Matching failure: results or bounded scores are incorrect.'
  \quit 1
\endif

select count(*)::integer as correct_top_count from (
  select family_id from public.match_families(40, null, null, null, null, null, null, null, null, 30, 0)
  limit 1
) ranked where family_id = :'match_family_b'::uuid \gset
\if :correct_top_count
\else
  \echo 'Matching failure: strongest compatible family was not ranked first.'
  \quit 1
\endif

select count(*)::integer as tie_order_count from (
  select family_id, row_number() over () as position
  from public.match_families(40, null, null, null, null, null, null, null, null, 30, 0)
) ranked
where (family_id = :'match_family_b'::uuid and position = 1)
   or (family_id = :'match_family_d'::uuid and position = 2) \gset
select (:tie_order_count = 2)::integer as tie_order_valid \gset
\if :tie_order_valid
\else
  \echo 'Matching failure: deterministic tie ordering is incorrect.'
  \quit 1
\endif

select count(*)::integer as availability_filter_count
from public.match_families(40, 'DE', null, null, null, null, null, 6, 'afternoon', 30, 0) \gset
select (:availability_filter_count = 2)::integer as availability_filter_valid \gset
\if :availability_filter_valid
\else
  \echo 'Matching failure: country/availability filters returned unexpected families.'
  \quit 1
\endif

select count(*)::integer as explanation_count
from public.match_families(40, null, null, null, null, null, null, null, null, 30, 0)
where family_id = :'match_family_b'::uuid
  and 'children_similar_age' = any(compatibility_reasons)
  and 'availability_overlap' = any(compatibility_reasons)
  and 'shared_origin_country' = any(compatibility_reasons) \gset
\if :explanation_count
\else
  \echo 'Matching failure: privacy-safe deterministic explanations are incomplete.'
  \quit 1
\endif

reset role;
rollback;
