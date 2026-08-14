\set ON_ERROR_STOP on
begin;

-- Phase 15 release scenario. Every write is rolled back after the complete
-- Schrobenhausen -> Ingolstadt family journey has been asserted.
\set release_user_a '6aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
\set release_user_b '6bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

insert into public.geocoding_cache(
  query_hash, provider_place_id, display_city, display_area, country_code,
  location, expires_at
) values
  (
    repeat('6', 64), 'phase15-schrobenhausen', 'Schrobenhausen', 'Bavaria', 'DE',
    extensions.st_setsrid(extensions.st_makepoint(11.260, 48.560), 4326)::extensions.geography,
    now() + interval '1 hour'
  ),
  (
    repeat('7', 64), 'phase15-aresing', 'Aresing', 'Bavaria', 'DE',
    extensions.st_setsrid(extensions.st_makepoint(11.300, 48.530), 4326)::extensions.geography,
    now() + interval '1 hour'
  ),
  (
    repeat('8', 64), 'phase15-ingolstadt', 'Ingolstadt', 'Bavaria', 'DE',
    extensions.st_setsrid(extensions.st_makepoint(11.425, 48.766), 4326)::extensions.geography,
    now() + interval '1 hour'
  );

insert into auth.users(
  id, email, email_confirmed_at, raw_user_meta_data, is_sso_user,
  is_anonymous, created_at, updated_at
) values
  (
    :'release_user_a', 'phase15-schrobenhausen@example.test', now(),
    '{"display_name":"Schrobenhausen Mother"}', false, false, now(), now()
  ),
  (
    :'release_user_b', 'phase15-ingolstadt@example.test', now(),
    '{"display_name":"Ingolstadt Guardian"}', false, false, now(), now()
  );

select set_config('request.jwt.claim.sub', :'release_user_a', true);
select set_config(
  'request.jwt.claims',
  json_build_object('sub', :'release_user_a', 'role', 'authenticated')::text,
  true
);
set local role authenticated;
select public.complete_family_onboarding_with_location(jsonb_build_object(
  'display_name', 'Schrobenhausen Mother',
  'preferred_language', 'de',
  'timezone', 'Europe/Berlin',
  'family', jsonb_build_object(
    'name', 'Schrobenhausen Cameroon Family',
    'country_of_residence', 'DE',
    'city', 'Schrobenhausen',
    'location_place_id', 'phase15-schrobenhausen',
    'radius_km', 50,
    'visibility', 'discoverable',
    'bio', 'A family preserving Cameroonian roots near Ingolstadt.'
  ),
  'children', jsonb_build_array(jsonb_build_object(
    'nickname', 'Little Root',
    'birth_year', extract(year from current_date)::integer - 7,
    'birth_month', 6,
    'gender', 'prefer_not_to_say'
  )),
  'culture_ids', jsonb_build_array('20000000-0000-4000-8000-000000000001'),
  'languages', jsonb_build_array(jsonb_build_object(
    'language_id', '30000000-0000-4000-8000-000000000003',
    'proficiency', 'fluent',
    'transmission_goal', 'want_to_teach_children'
  )),
  'preservation_goals', jsonb_build_array('language', 'stories'),
  'interest_ids', jsonb_build_array('40000000-0000-4000-8000-000000000001'),
  'availability', jsonb_build_array(jsonb_build_object(
    'weekday', 6, 'period', 'afternoon'
  )),
  'preferences', jsonb_build_object(
    'open_to_other_african_families', true,
    'open_to_all_diaspora_families', false,
    'min_child_age', 4,
    'max_child_age', 12
  )
)) as release_family_a \gset
select public.set_family_location('phase15-aresing', 50);
select public.set_family_location('phase15-schrobenhausen', 50);
reset role;

select set_config('request.jwt.claim.sub', :'release_user_b', true);
select set_config(
  'request.jwt.claims',
  json_build_object('sub', :'release_user_b', 'role', 'authenticated')::text,
  true
);
set local role authenticated;
select public.complete_family_onboarding_with_location(jsonb_build_object(
  'display_name', 'Ingolstadt Guardian',
  'preferred_language', 'en',
  'timezone', 'Europe/Berlin',
  'family', jsonb_build_object(
    'name', 'Ingolstadt Cameroon Family',
    'country_of_residence', 'DE',
    'city', 'Ingolstadt',
    'location_place_id', 'phase15-ingolstadt',
    'radius_km', 50,
    'visibility', 'discoverable',
    'bio', 'A nearby family with similar child ages.'
  ),
  'children', jsonb_build_array(jsonb_build_object(
    'nickname', 'Nearby Root',
    'birth_year', extract(year from current_date)::integer - 8,
    'birth_month', 4,
    'gender', 'prefer_not_to_say'
  )),
  'culture_ids', jsonb_build_array('20000000-0000-4000-8000-000000000001'),
  'languages', jsonb_build_array(jsonb_build_object(
    'language_id', '30000000-0000-4000-8000-000000000003',
    'proficiency', 'native',
    'transmission_goal', 'want_to_teach_children'
  )),
  'preservation_goals', jsonb_build_array('language', 'recipes'),
  'interest_ids', jsonb_build_array('40000000-0000-4000-8000-000000000001'),
  'availability', jsonb_build_array(jsonb_build_object(
    'weekday', 6, 'period', 'afternoon'
  )),
  'preferences', jsonb_build_object(
    'open_to_other_african_families', true,
    'open_to_all_diaspora_families', false,
    'min_child_age', 4,
    'max_child_age', 12
  )
)) as release_family_b \gset
reset role;

select id as release_profile_a from public.profiles
where auth_user_id = :'release_user_a'::uuid \gset
select id as release_profile_b from public.profiles
where auth_user_id = :'release_user_b'::uuid \gset
select id as release_child_a from public.children
where family_id = :'release_family_a'::uuid \gset

select set_config('request.jwt.claim.sub', :'release_user_a', true);
select set_config(
  'request.jwt.claims',
  json_build_object('sub', :'release_user_a', 'role', 'authenticated')::text,
  true
);
set local role authenticated;
select count(*)::integer as release_discovery_count
from public.discover_families(
  50,
  array['20000000-0000-4000-8000-000000000001'::uuid],
  null, null, 4, 12, 30, 0
)
where family_id = :'release_family_b'::uuid
  and 'shared_culture' = any(compatibility_reasons)
  and cardinality(child_age_ranges) > 0 \gset
select public.request_family_connection(:'release_family_b'::uuid)
  as release_connection \gset
reset role;

select set_config('request.jwt.claim.sub', :'release_user_b', true);
select set_config(
  'request.jwt.claims',
  json_build_object('sub', :'release_user_b', 'role', 'authenticated')::text,
  true
);
set local role authenticated;
select public.respond_family_connection(:'release_connection'::uuid, true);
reset role;

select set_config('request.jwt.claim.sub', :'release_user_a', true);
select set_config(
  'request.jwt.claims',
  json_build_object('sub', :'release_user_a', 'role', 'authenticated')::text,
  true
);
set local role authenticated;
select public.get_or_create_family_conversation(:'release_family_b'::uuid)
  as release_conversation \gset
select public.send_family_message(
  :'release_conversation'::uuid,
  'Would your family like to join a regional picnic?',
  null
) as release_message \gset
select public.create_village(
  'Cameroonian Families · Ingolstadt Region',
  'A trusted regional Village for Cameroonian families.',
  'local', null, 50, 'private', 30
) as release_village \gset
select public.invite_family_to_village(
  :'release_village'::uuid, :'release_family_b'::uuid
);
reset role;

select set_config('request.jwt.claim.sub', :'release_user_b', true);
select set_config(
  'request.jwt.claims',
  json_build_object('sub', :'release_user_b', 'role', 'authenticated')::text,
  true
);
set local role authenticated;
select public.respond_village_invitation(:'release_village'::uuid, true);
reset role;

select set_config('request.jwt.claim.sub', :'release_user_a', true);
select set_config(
  'request.jwt.claims',
  json_build_object('sub', :'release_user_a', 'role', 'authenticated')::text,
  true
);
set local role authenticated;
select public.create_village_event(
  :'release_village'::uuid,
  'Regional family picnic',
  'A family picnic for the Ingolstadt region.',
  'picnic',
  now() + interval '14 days',
  now() + interval '14 days 3 hours',
  'Ingolstadt riverside park',
  'Ingolstadt',
  'Private picnic meeting point, Ingolstadt',
  'Riverside park in the Ingolstadt area',
  'going', 20, now() + interval '13 days'
) as release_event \gset
select public.create_village_support_post(
  :'release_village'::uuid,
  'question', 'school', 'Preparing for a local school transition',
  'Which general municipal resources helped with the school transition?',
  true
) as release_support_post \gset
select mission_id as release_mission from public.list_cultural_missions_v3('en')
where culture_id = '20000000-0000-4000-8000-000000000001'::uuid
order by mission_id limit 1 \gset
select public.start_cultural_mission(:'release_mission'::uuid, null)
  as release_progress \gset
select public.complete_cultural_mission_step(
  :'release_mission'::uuid, (step ->> 'step_id')::uuid, null
)
from jsonb_array_elements((
  select steps from public.list_cultural_missions_v3('en')
  where mission_id = :'release_mission'::uuid
)) step
order by (step ->> 'position')::integer;
select public.create_roots_entry_from_mission(
  :'release_child_a'::uuid,
  :'release_mission'::uuid,
  'Our completed cultural activity',
  'A child-safe reflection saved after completing the activity.',
  now(), 'private'
) as release_roots_entry \gset
select public.request_roots_passport_export(:'release_child_a'::uuid)
  as release_export \gset
reset role;

select set_config('request.jwt.claim.sub', :'release_user_b', true);
select set_config(
  'request.jwt.claims',
  json_build_object('sub', :'release_user_b', 'role', 'authenticated')::text,
  true
);
set local role authenticated;
select count(*)::integer as release_address_hidden
from public.list_village_events(:'release_village'::uuid)
where event_id = :'release_event'::uuid
  and not address_visible and location_address is null \gset
select public.acknowledge_meeting_safety('event_rsvp');
select public.rsvp_village_event(:'release_event'::uuid, 'going', 2, 1)
  as release_rsvp \gset
select count(*)::integer as release_address_visible
from public.list_village_events(:'release_village'::uuid)
where event_id = :'release_event'::uuid
  and address_visible
  and location_address = 'Private picnic meeting point, Ingolstadt' \gset
reset role;

select count(*)::integer as release_message_count
from public.messages where id = :'release_message'::uuid \gset
select count(*)::integer as release_member_count
from public.village_members
where village_id = :'release_village'::uuid and status = 'active' \gset
select count(*)::integer as release_support_count
from public.village_support_posts where id = :'release_support_post'::uuid \gset
select count(*)::integer as release_mission_complete
from public.family_mission_progress
where id = :'release_progress'::uuid and status = 'completed' \gset
select count(*)::integer as release_roots_count
from public.roots_passport_entries where id = :'release_roots_entry'::uuid \gset
select count(*)::integer as release_export_count
from public.roots_passport_exports
where id = :'release_export'::uuid and status = 'queued' \gset
select count(*)::integer as release_location_count
from public.families
where id = :'release_family_a'::uuid and city = 'Schrobenhausen' \gset
select count(*)::integer as release_admission_rows
from public.pilot_waitlist
where profile_id in (:'release_profile_a'::uuid, :'release_profile_b'::uuid) \gset

select 1 / ((
  :release_discovery_count::integer = 1
  and :release_message_count::integer = 1
  and :release_member_count::integer = 2
  and :release_support_count::integer = 1
  and :release_mission_complete::integer = 1
  and :release_roots_count::integer = 1
  and :release_export_count::integer = 1
  and :release_location_count::integer = 1
  and :release_address_hidden::integer = 1
  and :release_address_visible::integer = 1
  and :'release_rsvp' = 'going'
  and :release_admission_rows::integer = 0
)::integer);

rollback;
