\set ON_ERROR_STOP on
begin;

do $$
begin
  if to_regprocedure('public.update_my_family_settings(jsonb)') is null then
    raise exception 'family settings RPC is missing';
  end if;
  if not has_function_privilege(
    'authenticated', 'public.update_my_family_settings(jsonb)', 'execute'
  ) then
    raise exception 'authenticated family settings access is missing';
  end if;
  if has_function_privilege(
    'anon', 'public.update_my_family_settings(jsonb)', 'execute'
  ) then
    raise exception 'anonymous family settings access exists';
  end if;
  if has_table_privilege('authenticated', 'public.children', 'insert')
     or has_table_privilege('authenticated', 'public.children', 'update')
     or has_table_privilege('authenticated', 'public.children', 'delete')
     or has_table_privilege('authenticated', 'public.families', 'update') then
    raise exception 'direct family profile mutation privileges still exist';
  end if;
end
$$;

\set settings_owner_user 'daaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
\set settings_guardian_user 'dbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
\set settings_member_user 'dccccccc-cccc-4ccc-8ccc-cccccccccccc'
\set settings_candidate_user 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
\set settings_family 'daaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
\set settings_candidate_family 'dddddddd-2222-4222-8222-dddddddddddd'
\set settings_protected_child 'daaaaaaa-3333-4333-8333-aaaaaaaaaaaa'
\set settings_removable_child 'daaaaaaa-4444-4444-8444-aaaaaaaaaaaa'
\set settings_candidate_child 'dddddddd-5555-4555-8555-dddddddddddd'
\set settings_passport 'daaaaaaa-6666-4666-8666-aaaaaaaaaaaa'

insert into auth.users(
  id, email, raw_user_meta_data, is_sso_user, is_anonymous,
  email_confirmed_at, created_at, updated_at
)
values
  (:'settings_owner_user', 'settings-owner@kinavela.invalid', '{"display_name":"Settings Owner"}', false, false, now(), now(), now()),
  (:'settings_guardian_user', 'settings-guardian@kinavela.invalid', '{"display_name":"Settings Guardian"}', false, false, now(), now(), now()),
  (:'settings_member_user', 'settings-member@kinavela.invalid', '{"display_name":"Settings Member"}', false, false, now(), now(), now()),
  (:'settings_candidate_user', 'settings-candidate@kinavela.invalid', '{"display_name":"Settings Candidate"}', false, false, now(), now(), now());

select id as settings_owner_profile
from public.profiles where auth_user_id = :'settings_owner_user'::uuid \gset
select id as settings_guardian_profile
from public.profiles where auth_user_id = :'settings_guardian_user'::uuid \gset
select id as settings_member_profile
from public.profiles where auth_user_id = :'settings_member_user'::uuid \gset
select id as settings_candidate_profile
from public.profiles where auth_user_id = :'settings_candidate_user'::uuid \gset

insert into public.families(
  id, name, slug, created_by, country_of_residence, city, location,
  discovery_radius_km, visibility, bio, preservation_goals
)
values
  (
    :'settings_family', 'Settings Family', 'settings-family',
    :'settings_owner_profile', 'DE', 'Ingolstadt',
    extensions.st_setsrid(extensions.st_makepoint(11.4257, 48.7665), 4326)::extensions.geography,
    40, 'discoverable', 'Before update', array['language']::text[]
  ),
  (
    :'settings_candidate_family', 'Settings Candidate Family', 'settings-candidate-family',
    :'settings_candidate_profile', 'DE', 'Manching',
    extensions.st_setsrid(extensions.st_makepoint(11.4939, 48.7166), 4326)::extensions.geography,
    40, 'discoverable', 'Candidate', array['language']::text[]
  );

insert into public.family_members(family_id, profile_id, role, status)
values
  (:'settings_family', :'settings_owner_profile', 'owner', 'active'),
  (:'settings_family', :'settings_guardian_profile', 'guardian', 'active'),
  (:'settings_family', :'settings_member_profile', 'member', 'active'),
  (:'settings_candidate_family', :'settings_candidate_profile', 'owner', 'active');

insert into public.children(id, family_id, nickname, birth_year, birth_month, visibility)
values
  (:'settings_protected_child', :'settings_family', 'Memory child', 2020, 6, 'guardians'),
  (:'settings_removable_child', :'settings_family', 'Removable child', 2018, null, 'guardians'),
  (:'settings_candidate_child', :'settings_candidate_family', 'Candidate child', 2020, 6, 'guardians');

select id as settings_passport
from public.roots_passports
where child_id = 'daaaaaaa-3333-4333-8333-aaaaaaaaaaaa'::uuid \gset
insert into public.roots_passport_entries(
  passport_id, type, title, created_by_profile_id
)
values (:'settings_passport', 'language', 'A protected memory', :'settings_owner_profile');

insert into public.discovery_preferences(family_id)
values (:'settings_family'), (:'settings_candidate_family');
insert into public.family_cultures(family_id, culture_id, relationship_type, priority)
values
  (:'settings_family', '20000000-0000-4000-8000-000000000001', 'origin', 5),
  (:'settings_candidate_family', '20000000-0000-4000-8000-000000000001', 'origin', 5);
insert into public.family_languages(family_id, language_id, proficiency, transmission_goal)
values
  (:'settings_family', '30000000-0000-4000-8000-000000000003', 'fluent', 'want_to_teach_children'),
  (:'settings_candidate_family', '30000000-0000-4000-8000-000000000003', 'fluent', 'want_to_teach_children');
insert into public.family_interests(family_id, interest_id)
values
  (:'settings_family', '40000000-0000-4000-8000-000000000001'),
  (:'settings_candidate_family', '40000000-0000-4000-8000-000000000001');
insert into public.family_availability(family_id, weekday, period)
values
  (:'settings_family', 6, 'afternoon'),
  (:'settings_candidate_family', 6, 'afternoon');

insert into public.geocoding_cache(
  query_hash, provider_place_id, display_city, display_area, country_code, location
)
values (
  repeat('e', 64), 'phase-b-aresing', 'Aresing', 'Bavaria', 'DE',
  extensions.st_setsrid(extensions.st_makepoint(11.3000, 48.5333), 4326)::extensions.geography
);

select set_config('request.jwt.claim.sub', :'settings_owner_user', true);
select set_config(
  'request.jwt.claims',
  json_build_object('sub', :'settings_owner_user', 'role', 'authenticated')::text,
  true
);
set local role authenticated;

select match_score as score_before
from public.match_families(40, null, null, null, null, null, null, null, null, 30, 0)
where family_id = :'settings_candidate_family'::uuid \gset

do $$
begin
  begin
    perform public.update_my_family_settings($json$
    {
      "family":{"name":"Unsafe deletion","bio":"","visibility":"discoverable"},
      "children":[{"id":"daaaaaaa-4444-4444-8444-aaaaaaaaaaaa","nickname":"Removable child","birth_year":2018,"birth_month":null,"gender":null,"visibility":"guardians"}],
      "cultures":[{"culture_id":"20000000-0000-4000-8000-000000000001","relationship_type":"origin","priority":5}],
      "languages":[{"language_id":"30000000-0000-4000-8000-000000000003","proficiency":"fluent","transmission_goal":"want_to_teach_children"}],
      "preservation_goals":["language"],
      "interest_ids":["40000000-0000-4000-8000-000000000001"],
      "availability":[{"weekday":6,"period":"afternoon"}],
      "preferences":{"same_country_priority":4,"same_culture_priority":4,"similar_child_age_priority":4,"same_language_priority":3,"shared_interests_priority":3,"availability_priority":2,"open_to_other_african_families":true,"open_to_all_diaspora_families":false,"min_child_age":0,"max_child_age":18}
    }
    $json$::jsonb);
    raise exception 'expected child_has_cultural_history';
  exception when others then
    if sqlerrm <> 'child_has_cultural_history' then raise; end if;
  end;
end
$$;

select public.update_my_family_settings($json$
{
  "family":{"name":"Updated Aresing Family","bio":"Updated family profile","visibility":"discoverable"},
  "children":[
    {"id":"daaaaaaa-3333-4333-8333-aaaaaaaaaaaa","nickname":"Memory child updated","birth_year":2020,"birth_month":7,"gender":"prefer_not_to_say","visibility":"connections"},
    {"id":null,"nickname":"New child","birth_year":2022,"birth_month":null,"gender":null,"visibility":"guardians"}
  ],
  "cultures":[{"culture_id":"20000000-0000-4000-8000-000000000006","relationship_type":"connection","priority":3}],
  "languages":[
    {"language_id":"30000000-0000-4000-8000-000000000001","proficiency":"fluent","transmission_goal":"already_speaking"},
    {"language_id":"30000000-0000-4000-8000-000000000002","proficiency":"conversational","transmission_goal":"want_to_teach_children"}
  ],
  "preservation_goals":["language","stories","traditions"],
  "interest_ids":["40000000-0000-4000-8000-000000000003"],
  "availability":[{"weekday":1,"period":"morning"},{"weekday":3,"period":"evening"}],
  "preferences":{"same_country_priority":5,"same_culture_priority":5,"similar_child_age_priority":5,"same_language_priority":5,"shared_interests_priority":5,"availability_priority":5,"open_to_other_african_families":false,"open_to_all_diaspora_families":true,"min_child_age":2,"max_child_age":14}
}
$json$::jsonb);

select match_score as score_after
from public.match_families(40, null, null, null, null, null, null, null, null, 30, 0)
where family_id = :'settings_candidate_family'::uuid \gset

select 1 / ((:'score_after'::integer < :'score_before'::integer)::integer);

do $$
begin
  if not exists (
    select 1 from public.families
    where id = 'daaaaaaa-1111-4111-8111-aaaaaaaaaaaa'::uuid
      and name = 'Updated Aresing Family'
      and bio = 'Updated family profile'
      and preservation_goals @> array['stories', 'traditions']::text[]
  ) then raise exception 'family profile update failed'; end if;
  if exists (
    select 1 from public.children where id = 'daaaaaaa-4444-4444-8444-aaaaaaaaaaaa'::uuid
  ) then raise exception 'confirmed child removal failed'; end if;
  if (select count(*) from public.children where family_id = 'daaaaaaa-1111-4111-8111-aaaaaaaaaaaa'::uuid) <> 2
     or not exists (
       select 1 from public.children
       where id = 'daaaaaaa-3333-4333-8333-aaaaaaaaaaaa'::uuid
         and nickname = 'Memory child updated'
         and visibility = 'connections'
     ) then raise exception 'child add/update failed'; end if;
  if (select count(*) from public.family_languages where family_id = 'daaaaaaa-1111-4111-8111-aaaaaaaaaaaa'::uuid) <> 2
     or (select count(*) from public.family_availability where family_id = 'daaaaaaa-1111-4111-8111-aaaaaaaaaaaa'::uuid) <> 2 then
    raise exception 'multiple language or availability update failed';
  end if;
end
$$;

select public.set_family_location('phase-b-aresing', 55);

do $$
begin
  if not exists (
    select 1
    from public.families family
    join public.profiles profile on profile.auth_user_id = 'daaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid
    where family.id = 'daaaaaaa-1111-4111-8111-aaaaaaaaaaaa'::uuid
      and family.city = 'Aresing'
      and profile.city = 'Aresing'
      and family.discovery_radius_km = 55
  ) then raise exception 'geocoded family/profile location synchronization failed'; end if;

  begin
    update public.profiles
    set city = 'Free text divergence'
    where auth_user_id = 'daaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid;
    raise exception 'expected profile city permission failure';
  exception when insufficient_privilege then null;
  end;
end
$$;

reset role;
select set_config('request.jwt.claim.sub', :'settings_guardian_user', true);
select set_config(
  'request.jwt.claims',
  json_build_object('sub', :'settings_guardian_user', 'role', 'authenticated')::text,
  true
);
set local role authenticated;

select 1 / ((count(*) = 2)::integer)
from public.children
where family_id = 'daaaaaaa-1111-4111-8111-aaaaaaaaaaaa'::uuid;

do $$
begin
  begin
    perform public.update_my_family_settings('{}'::jsonb);
    raise exception 'expected owner_required';
  exception when others then
    if sqlerrm <> 'owner_required' then raise; end if;
  end;
end
$$;

reset role;
select set_config('request.jwt.claim.sub', :'settings_member_user', true);
select set_config(
  'request.jwt.claims',
  json_build_object('sub', :'settings_member_user', 'role', 'authenticated')::text,
  true
);
set local role authenticated;

select 1 / ((count(*) = 0)::integer)
from public.children
where family_id = 'daaaaaaa-1111-4111-8111-aaaaaaaaaaaa'::uuid;

do $$
begin
  begin
    perform public.update_my_family_settings('{}'::jsonb);
    raise exception 'expected owner_required';
  exception when others then
    if sqlerrm <> 'owner_required' then raise; end if;
  end;
end
$$;

reset role;
rollback;
