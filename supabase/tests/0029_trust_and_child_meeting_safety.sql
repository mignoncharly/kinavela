begin;

do $$
begin
  if not exists (
    select 1 from pg_class where oid = 'public.profile_verification_records'::regclass
      and relrowsecurity and relforcerowsecurity
  ) or not exists (
    select 1 from pg_class where oid = 'public.community_verification_requests'::regclass
      and relrowsecurity and relforcerowsecurity
  ) or not exists (
    select 1 from pg_class where oid = 'public.meeting_safety_acknowledgements'::regclass
      and relrowsecurity and relforcerowsecurity
  ) or not exists (
    select 1 from pg_class where oid = 'public.report_action_history'::regclass
      and relrowsecurity and relforcerowsecurity
  ) then
    raise exception 'Phase 6 trust/safety tables must use forced RLS';
  end if;
  if has_table_privilege('authenticated', 'public.profile_verification_records', 'select')
    or has_table_privilege('authenticated', 'public.community_verification_requests', 'select')
    or has_table_privilege('authenticated', 'public.meeting_safety_acknowledgements', 'select')
    or has_table_privilege('authenticated', 'public.report_action_history', 'select') then
    raise exception 'Phase 6 tables must remain RPC-only';
  end if;
  if has_function_privilege('authenticated', 'public.admin_set_report_status(uuid,text)', 'execute') then
    raise exception 'Legacy report-status bypass remains executable';
  end if;
  if has_function_privilege(
    'anon', 'public.admin_list_report_action_history(uuid)', 'execute'
  ) or not has_function_privilege(
    'authenticated', 'public.admin_list_report_action_history(uuid)', 'execute'
  ) then raise exception 'Report action-history grants violate least privilege'; end if;
end $$;

\set phase6_user_a '2aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
\set phase6_user_b '2bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
\set phase6_user_c '2ccccccc-cccc-4ccc-8ccc-cccccccccccc'
\set phase6_user_d '2ddddddd-dddd-4ddd-8ddd-dddddddddddd'
\set phase6_family_a '2aaaaaaa-2222-4222-8222-aaaaaaaaaaaa'
\set phase6_family_b '2bbbbbbb-2222-4222-8222-bbbbbbbbbbbb'
\set phase6_family_c '2ccccccc-2222-4222-8222-cccccccccccc'

insert into auth.users(
  id, email, phone, email_confirmed_at, phone_confirmed_at, raw_user_meta_data,
  is_sso_user, is_anonymous, created_at, updated_at
)
values
  (:'phase6_user_a', 'phase6-a@example.test', '+4915111111111', now(), now(), '{"display_name":"Owner A"}', false, false, now(), now()),
  (:'phase6_user_b', 'phase6-b@example.test', null, now(), null, '{"display_name":"Owner B"}', false, false, now(), now()),
  (:'phase6_user_c', 'phase6-c@example.test', null, now(), null, '{"display_name":"Moderator C"}', false, false, now(), now()),
  (:'phase6_user_d', 'phase6-admin@example.test', null, now(), null, '{"display_name":"Admin D"}', false, false, now(), now());

select id as phase6_profile_a from public.profiles where auth_user_id = :'phase6_user_a'::uuid \gset
select id as phase6_profile_b from public.profiles where auth_user_id = :'phase6_user_b'::uuid \gset
select id as phase6_profile_c from public.profiles where auth_user_id = :'phase6_user_c'::uuid \gset
select id as phase6_profile_d from public.profiles where auth_user_id = :'phase6_user_d'::uuid \gset

update public.profiles set onboarding_completed = true where auth_user_id in (
  :'phase6_user_a'::uuid, :'phase6_user_b'::uuid,
  :'phase6_user_c'::uuid, :'phase6_user_d'::uuid
);

insert into public.families(
  id, name, slug, created_by, country_of_residence, city, location,
  visibility, discovery_radius_km
)
values
  (:'phase6_family_a', 'Family A', 'phase6-family-a', :'phase6_profile_a', 'DE', 'Ingolstadt', extensions.st_setsrid(extensions.st_makepoint(11.425, 48.766), 4326)::extensions.geography, 'discoverable', 40),
  (:'phase6_family_b', 'Family B', 'phase6-family-b', :'phase6_profile_b', 'DE', 'Ingolstadt', extensions.st_setsrid(extensions.st_makepoint(11.430, 48.766), 4326)::extensions.geography, 'discoverable', 40),
  (:'phase6_family_c', 'Family C', 'phase6-family-c', :'phase6_profile_c', 'DE', 'Ingolstadt', extensions.st_setsrid(extensions.st_makepoint(11.435, 48.766), 4326)::extensions.geography, 'discoverable', 40);

insert into public.family_members(family_id, profile_id, role, status)
values
  (:'phase6_family_a', :'phase6_profile_a', 'owner', 'active'),
  (:'phase6_family_b', :'phase6_profile_b', 'owner', 'active'),
  (:'phase6_family_c', :'phase6_profile_c', 'owner', 'active');

insert into public.profile_verification_records(
  profile_id, verification_type, verification_method, verified_by_profile_id, statement
)
values (
  :'phase6_profile_c', 'community', 'staff_review',
  :'phase6_profile_d',
  'Kinavela staff reviewed this adult profile community-verification request.'
);

insert into kinavela_private.admin_roles(profile_id, role)
values (:'phase6_profile_d', 'admin');

insert into public.villages(
  id, name, slug, description, village_type, city, center_location, radius_km,
  visibility, created_by_family_id, created_by_profile_id, member_limit
)
values (
  '2aaaaaaa-3333-4333-8333-aaaaaaaaaaaa', 'Phase 6 Village', 'phase-6-village',
  'A private local Village for Phase 6 safety assertions.', 'local', 'Ingolstadt',
  extensions.st_setsrid(extensions.st_makepoint(11.425, 48.766), 4326)::extensions.geography,
  40, 'listed', :'phase6_family_c',
  :'phase6_profile_c', 20
);

insert into public.village_members(village_id, family_id, role, status, initiated_by_family_id, joined_at)
values
  ('2aaaaaaa-3333-4333-8333-aaaaaaaaaaaa', :'phase6_family_a', 'member', 'active', :'phase6_family_c', now()),
  ('2aaaaaaa-3333-4333-8333-aaaaaaaaaaaa', :'phase6_family_b', 'member', 'active', :'phase6_family_c', now()),
  ('2aaaaaaa-3333-4333-8333-aaaaaaaaaaaa', :'phase6_family_c', 'owner', 'active', :'phase6_family_c', now());

insert into public.events(
  id, village_id, creator_family_id, creator_profile_id, title, description,
  category, starts_at, ends_at, location_name, location_city,
  public_location_description, registration_deadline
)
values (
  '2aaaaaaa-4444-4444-8444-aaaaaaaaaaaa',
  '2aaaaaaa-3333-4333-8333-aaaaaaaaaaaa',
  :'phase6_family_b',
  :'phase6_profile_b',
  'Reported family picnic', 'An event created for report and safety assertions.',
  'picnic', now() + interval '2 days', now() + interval '2 days 3 hours',
  'Public park', 'Ingolstadt', 'A public park in central Ingolstadt',
  now() + interval '1 day'
);
insert into kinavela_private.event_locations(event_id, location_address)
values ('2aaaaaaa-4444-4444-8444-aaaaaaaaaaaa', 'Private test address');

create function pg_temp.phase6_call_denied(p_operation text, p_id uuid default null)
returns boolean language plpgsql as $$
begin
  if p_operation = 'rsvp' then
    perform public.rsvp_village_event(
      '2aaaaaaa-4444-4444-8444-aaaaaaaaaaaa', 'going', 1, 1
    );
  elsif p_operation = 'self_endorse' then
    perform public.endorse_community_verification(p_id);
  elsif p_operation = 'urgent_dismiss' then
    perform public.resolve_village_report(p_id, 'dismiss');
  end if;
  return false;
exception when others then
  return sqlerrm like case p_operation
    when 'rsvp' then '%meeting_safety_acknowledgement_required%'
    when 'self_endorse' then '%verification_request_not_available%'
    else '%urgent_report_requires_staff_review%'
  end;
end $$;

select set_config('request.jwt.claim.sub', '2aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
select set_config('request.jwt.claims', '{"sub":"2aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;
select pg_temp.phase6_call_denied('rsvp')::integer as rsvp_blocked \gset
select public.acknowledge_meeting_safety('event_rsvp');
select public.rsvp_village_event(
  '2aaaaaaa-4444-4444-8444-aaaaaaaaaaaa', 'going', 1, 1
) as rsvp_status \gset
select public.request_community_verification(
  '2aaaaaaa-3333-4333-8333-aaaaaaaaaaaa'
) as verification_request_id \gset
select pg_temp.phase6_call_denied(
  'self_endorse', :'verification_request_id'::uuid
)::integer as self_endorse_blocked \gset
select public.submit_report(
  'event', '2aaaaaaa-4444-4444-8444-aaaaaaaaaaaa',
  'child_safety_concern', 'The public event information raises a child-safety concern.'
) as event_report_id \gset
reset role;

select count(*)::integer as critical_triage
from public.reports
where id = :'event_report_id'::uuid
  and target_type = 'event'
  and target_event_id = '2aaaaaaa-4444-4444-8444-aaaaaaaaaaaa'
  and target_village_id = '2aaaaaaa-3333-4333-8333-aaaaaaaaaaaa'
  and severity = 'critical'
  and urgent_child_safety
  and response_due_at <= created_at + interval '1 hour 1 minute' \gset
select count(*)::integer as submission_history
from public.report_action_history
where report_id = :'event_report_id'::uuid and action_type = 'submitted' \gset

select set_config('request.jwt.claim.sub', '2ccccccc-cccc-4ccc-8ccc-cccccccccccc', true);
select set_config('request.jwt.claims', '{"sub":"2ccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated"}', true);
set local role authenticated;
select count(*)::integer as village_report_visible
from public.list_village_reports('2aaaaaaa-3333-4333-8333-aaaaaaaaaaaa')
where report_id = :'event_report_id'::uuid and urgent_child_safety \gset
select pg_temp.phase6_call_denied(
  'urgent_dismiss', :'event_report_id'::uuid
)::integer as urgent_dismiss_blocked \gset
select public.endorse_community_verification(:'verification_request_id'::uuid);
select public.resolve_village_report(:'event_report_id'::uuid, 'restrict_event');
reset role;

select count(*)::integer as endorsed
from public.profile_verification_records
where profile_id = :'phase6_profile_a'::uuid
  and verification_type = 'community'
  and verification_method = 'established_village_moderator_endorsement'
  and revoked_at is null \gset
select count(*)::integer as event_restricted
from public.events
where id = '2aaaaaaa-4444-4444-8444-aaaaaaaaaaaa'
  and moderation_status = 'restricted' and status = 'cancelled' \gset

select set_config('request.jwt.claim.sub', '2ddddddd-dddd-4ddd-8ddd-dddddddddddd', true);
select set_config('request.jwt.claims', '{"sub":"2ddddddd-dddd-4ddd-8ddd-dddddddddddd","role":"authenticated"}', true);
set local role authenticated;
select public.admin_manage_report(
  :'event_report_id'::uuid, 'resolve', null,
  'Reviewed the structured report and restricted the event; no private address copied.'
);
select count(*)::integer as admin_projection
from public.admin_list_reports(null, 100)
where report_id = :'event_report_id'::uuid
  and status = 'resolved' and severity = 'critical'
  and target_event_title = 'Reported family picnic'
  and resolution_notes is not null and action_count >= 3 \gset
select count(*)::integer as admin_history_visible
from public.admin_list_report_action_history(:'event_report_id'::uuid)
where action_type in ('submitted', 'event_restricted', 'resolved')
  and (
    action_type <> 'resolved'
    or note = 'Reviewed the structured report and restricted the event; no private address copied.'
  ) \gset
reset role;

select count(*)::integer as auth_records
from public.profile_verification_records
where profile_id = :'phase6_profile_a'::uuid
  and verification_type in ('email', 'phone') and revoked_at is null \gset
select count(*)::integer as private_leak
from public.audit_events
where entity_id in (
  :'event_report_id'::uuid,
  '2aaaaaaa-4444-4444-8444-aaaaaaaaaaaa'::uuid
)
and (
  metadata ? 'location_address'
  or metadata ? 'message_body'
  or metadata::text like '%Private test address%'
) \gset

select (
  :rsvp_blocked = 1 and :'rsvp_status' in ('going', 'waitlisted')
  and :self_endorse_blocked = 1 and :critical_triage = 1
  and :submission_history = 1 and :village_report_visible = 1
  and :urgent_dismiss_blocked = 1 and :endorsed = 1
  and :event_restricted = 1 and :admin_projection = 1
  and :admin_history_visible = 3 and :auth_records = 2 and :private_leak = 0
)::integer as phase6_valid \gset
select :rsvp_blocked as rsvp_blocked,
  :'rsvp_status' as rsvp_status,
  :self_endorse_blocked as self_endorse_blocked,
  :critical_triage as critical_triage,
  :submission_history as submission_history,
  :village_report_visible as village_report_visible,
  :urgent_dismiss_blocked as urgent_dismiss_blocked,
  :endorsed as endorsed,
  :event_restricted as event_restricted,
  :admin_projection as admin_projection,
  :admin_history_visible as admin_history_visible,
  :auth_records as auth_records,
  :private_leak as private_leak;
select 1 / :phase6_valid;

rollback;
