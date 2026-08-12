\set ON_ERROR_STOP on
begin;

do $$
declare table_name text;
begin
  foreach table_name in array array['events', 'event_attendees', 'event_reminder_deliveries'] loop
    if not exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = table_name
        and c.relrowsecurity and c.relforcerowsecurity
    ) then raise exception 'Phase 8 table % must use forced RLS', table_name; end if;
  end loop;
  if has_table_privilege('authenticated', 'public.events', 'insert')
     or has_table_privilege('authenticated', 'public.event_attendees', 'update')
     or has_table_privilege('authenticated', 'kinavela_private.event_locations', 'select') then
    raise exception 'Event tables must remain RPC-only and private locations inaccessible';
  end if;
  if has_function_privilege('anon',
       'public.create_village_event(uuid,text,text,text,timestamptz,timestamptz,text,text,text,text,text,integer,timestamptz)',
       'execute')
     or has_function_privilege('authenticated',
       'kinavela_private.can_view_event_address(uuid)', 'execute')
     or has_function_privilege('authenticated',
       'public.dispatch_due_event_reminders()', 'execute') then
    raise exception 'Phase 8 function grants are too broad';
  end if;
end $$;

\set event_user_a 'a4aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
\set event_user_b 'b4bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
\set event_user_c 'c4cccccc-cccc-4ccc-8ccc-cccccccccccc'
\set event_user_d 'd4dddddd-dddd-4ddd-8ddd-dddddddddddd'
\set event_family_a 'a4aaaaaa-1111-4111-8111-aaaaaaaaaaaa'
\set event_family_b 'b4bbbbbb-2222-4222-8222-bbbbbbbbbbbb'
\set event_family_c 'c4cccccc-3333-4333-8333-cccccccccccc'
\set event_family_d 'd4dddddd-4444-4444-8444-dddddddddddd'
\set event_village 'e4eeeeee-5555-4555-8555-eeeeeeeeeeee'

insert into auth.users(id, email, raw_user_meta_data, is_sso_user, is_anonymous, created_at, updated_at) values
  (:'event_user_a', 'event-a@kinavela.invalid', '{"display_name":"Event A"}', false, false, now(), now()),
  (:'event_user_b', 'event-b@kinavela.invalid', '{"display_name":"Event B"}', false, false, now(), now()),
  (:'event_user_c', 'event-c@kinavela.invalid', '{"display_name":"Event C"}', false, false, now(), now()),
  (:'event_user_d', 'event-d@kinavela.invalid', '{"display_name":"Event D"}', false, false, now(), now());

select id as event_profile_a from public.profiles where auth_user_id = :'event_user_a'::uuid \gset
select id as event_profile_b from public.profiles where auth_user_id = :'event_user_b'::uuid \gset
select id as event_profile_c from public.profiles where auth_user_id = :'event_user_c'::uuid \gset
select id as event_profile_d from public.profiles where auth_user_id = :'event_user_d'::uuid \gset

insert into public.families(id, name, slug, created_by, country_of_residence, city, location, discovery_radius_km) values
  (:'event_family_a', 'Event Family A', 'event-family-a', :'event_profile_a', 'DE', 'Berlin', extensions.st_setsrid(extensions.st_makepoint(13.405, 52.520), 4326)::extensions.geography, 40),
  (:'event_family_b', 'Event Family B', 'event-family-b', :'event_profile_b', 'DE', 'Berlin', extensions.st_setsrid(extensions.st_makepoint(13.410, 52.522), 4326)::extensions.geography, 40),
  (:'event_family_c', 'Event Family C', 'event-family-c', :'event_profile_c', 'DE', 'Berlin', extensions.st_setsrid(extensions.st_makepoint(13.415, 52.524), 4326)::extensions.geography, 40),
  (:'event_family_d', 'Event Family D', 'event-family-d', :'event_profile_d', 'DE', 'Berlin', extensions.st_setsrid(extensions.st_makepoint(13.420, 52.526), 4326)::extensions.geography, 40);
insert into public.family_members(family_id, profile_id, role, status) values
  (:'event_family_a', :'event_profile_a', 'owner', 'active'),
  (:'event_family_b', :'event_profile_b', 'owner', 'active'),
  (:'event_family_c', :'event_profile_c', 'owner', 'active'),
  (:'event_family_d', :'event_profile_d', 'owner', 'active');

insert into public.villages(
  id, name, slug, description, city, center_location,
  created_by_family_id, created_by_profile_id, member_limit
) values (
  :'event_village', 'Phase 8 Village', 'phase-8-village',
  'A private Village used for event authorization acceptance tests.', 'Berlin',
  extensions.st_setsrid(extensions.st_makepoint(13.405, 52.520), 4326)::extensions.geography,
  :'event_family_a', :'event_profile_a', 20
);
insert into public.village_members(village_id, family_id, role, status, initiated_by_family_id, joined_at, responded_at) values
  (:'event_village', :'event_family_a', 'owner', 'active', :'event_family_a', now(), now()),
  (:'event_village', :'event_family_b', 'member', 'active', :'event_family_a', now(), now()),
  (:'event_village', :'event_family_c', 'member', 'active', :'event_family_a', now(), now());

create function pg_temp.event_call_denied(p_operation text, p_village_id uuid, p_event_id uuid default null)
returns boolean language plpgsql as $$
begin
  case p_operation
    when 'create' then perform public.create_village_event(
      p_village_id, 'Unauthorized event', 'This event must never be created.',
      'other', now() + interval '4 days', now() + interval '5 days',
      'Private Hall', 'Berlin', 'Secret Street 9, Berlin', 'Berlin area',
      'going', 5, now() + interval '3 days'
    );
    when 'list' then perform 1 from public.list_village_events(p_village_id);
    when 'cancel' then perform public.cancel_village_event(p_event_id);
    when 'direct' then perform 1 from public.events where village_id = p_village_id;
  end case;
  return false;
exception when others then return true;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', :'event_user_a', true);
select set_config('request.jwt.claims', json_build_object('sub', :'event_user_a', 'role', 'authenticated')::text, true);
select public.create_village_event(
  :'event_village', 'Capacity picnic', 'A complete family activity with a private exact address.',
  'picnic', now() + interval '4 days', now() + interval '4 days 4 hours',
  'Community Park', 'Berlin', 'Private Park Gate 7, Berlin', 'A central Berlin park',
  'going', 1, now() + interval '3 days'
) as event_id \gset
select count(*)::integer as manager_address from public.list_village_events(:'event_village')
where event_id = :'event_id'::uuid and location_address = 'Private Park Gate 7, Berlin'
  and address_visible and can_manage \gset
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', :'event_user_b', true);
select set_config('request.jwt.claims', json_build_object('sub', :'event_user_b', 'role', 'authenticated')::text, true);
select pg_temp.event_call_denied('create', :'event_village')::integer as member_create_denied \gset
select count(*)::integer as hidden_before_rsvp from public.list_village_events(:'event_village')
where event_id = :'event_id'::uuid and location_address is null and not address_visible \gset
select public.rsvp_village_event(:'event_id', 'going', 2, 2) as family_b_status \gset
select count(*)::integer as visible_after_rsvp from public.list_village_events(:'event_village')
where event_id = :'event_id'::uuid and location_address = 'Private Park Gate 7, Berlin' and address_visible \gset
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', :'event_user_c', true);
select set_config('request.jwt.claims', json_build_object('sub', :'event_user_c', 'role', 'authenticated')::text, true);
select public.rsvp_village_event(:'event_id', 'going', 1, 1) as family_c_status \gset
select count(*)::integer as waitlist_address_hidden from public.list_village_events(:'event_village')
where event_id = :'event_id'::uuid and current_rsvp_status = 'waitlisted'
  and location_address is null and not address_visible \gset
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', :'event_user_b', true);
select set_config('request.jwt.claims', json_build_object('sub', :'event_user_b', 'role', 'authenticated')::text, true);
select public.rsvp_village_event(:'event_id', 'declined', 2, 2);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', :'event_user_c', true);
select set_config('request.jwt.claims', json_build_object('sub', :'event_user_c', 'role', 'authenticated')::text, true);
select count(*)::integer as promoted_to_going from public.list_village_events(:'event_village')
where event_id = :'event_id'::uuid and current_rsvp_status = 'going'
  and location_address = 'Private Park Gate 7, Berlin' and latest_reminder_kind = 'waitlist_promoted' \gset
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', :'event_user_a', true);
select set_config('request.jwt.claims', json_build_object('sub', :'event_user_a', 'role', 'authenticated')::text, true);
select public.send_event_reminder(:'event_id') as reminder_recipients \gset
select public.create_village_event(
  :'event_village', 'Today family activity', 'An activity used to confirm real-world attendance.',
  'cultural', now() + interval '1 hour', now() + interval '3 hours',
  'Culture Hall', 'Berlin', 'Private Culture Hall 3, Berlin', 'A hall in central Berlin',
  'going', 10, now() + interval '30 minutes'
) as attendance_event_id \gset
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', :'event_user_b', true);
select set_config('request.jwt.claims', json_build_object('sub', :'event_user_b', 'role', 'authenticated')::text, true);
select public.rsvp_village_event(:'attendance_event_id', 'going', 2, 1);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', :'event_user_a', true);
select set_config('request.jwt.claims', json_build_object('sub', :'event_user_a', 'role', 'authenticated')::text, true);
select public.confirm_event_attendance(:'attendance_event_id', :'event_family_b', true);
select count(*)::integer as attendance_confirmed from public.list_event_attendees(:'attendance_event_id')
where family_id = :'event_family_b'::uuid and attendance_confirmed \gset
select public.cancel_village_event(:'event_id');
select count(*)::integer as cancellation_logged from public.audit_events
where event_type = 'event_cancelled' and entity_id = :'event_id'::uuid \gset
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', :'event_user_d', true);
select set_config('request.jwt.claims', json_build_object('sub', :'event_user_d', 'role', 'authenticated')::text, true);
select pg_temp.event_call_denied('list', :'event_village')::integer as nonmember_rpc_denied \gset
select pg_temp.event_call_denied('direct', :'event_village')::integer as nonmember_direct_denied \gset
select pg_temp.event_call_denied('cancel', :'event_village', :'attendance_event_id')::integer as nonmember_cancel_denied \gset
reset role;

select (
  :manager_address = 1 and :member_create_denied = 1 and :hidden_before_rsvp = 1
  and :'family_b_status' = 'going' and :visible_after_rsvp = 1
  and :'family_c_status' = 'waitlisted' and :waitlist_address_hidden = 1
  and :promoted_to_going = 1 and :reminder_recipients >= 1
  and :attendance_confirmed = 1 and :cancellation_logged = 1
  and :nonmember_rpc_denied = 1 and :nonmember_direct_denied = 1
  and :nonmember_cancel_denied = 1
)::integer as phase8_valid \gset
\if :phase8_valid
\else
  \echo 'Phase 8 failure: event authorization, address privacy, waitlist, reminder, or attendance assertion failed.'
  select 1 / 0;
\endif

rollback;
