begin;

do $$
begin
  if not exists (
    select 1 from pg_class
    where oid = 'public.village_support_posts'::regclass
      and relrowsecurity and relforcerowsecurity
  ) or not exists (
    select 1 from pg_class
    where oid = 'public.village_support_replies'::regclass
      and relrowsecurity and relforcerowsecurity
  ) then raise exception 'Phase 7 support tables must use forced RLS'; end if;
  if has_table_privilege(
    'authenticated', 'public.village_support_posts', 'select'
  ) or has_table_privilege(
    'authenticated', 'public.village_support_replies', 'select'
  ) then raise exception 'Phase 7 support tables must remain RPC-only'; end if;
  if has_function_privilege(
    'anon',
    'public.list_village_support_posts(uuid,text,text,text,text,timestamptz,integer)',
    'execute'
  ) then raise exception 'Anonymous support-board access is forbidden'; end if;
end $$;

\set phase7_user_a '3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
\set phase7_user_b '3bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
\set phase7_user_c '3ccccccc-cccc-4ccc-8ccc-cccccccccccc'
\set phase7_family_a '3aaaaaaa-2222-4222-8222-aaaaaaaaaaaa'
\set phase7_family_b '3bbbbbbb-2222-4222-8222-bbbbbbbbbbbb'
\set phase7_family_c '3ccccccc-2222-4222-8222-cccccccccccc'
\set phase7_village '3aaaaaaa-3333-4333-8333-aaaaaaaaaaaa'

insert into auth.users(
  id, email, email_confirmed_at, raw_user_meta_data,
  is_sso_user, is_anonymous, created_at, updated_at
) values
  (:'phase7_user_a', 'phase7-a@example.test', now(), '{"display_name":"Owner A"}', false, false, now(), now()),
  (:'phase7_user_b', 'phase7-b@example.test', now(), '{"display_name":"Owner B"}', false, false, now(), now()),
  (:'phase7_user_c', 'phase7-c@example.test', now(), '{"display_name":"Moderator C"}', false, false, now(), now());

select id as phase7_profile_a from public.profiles
where auth_user_id = :'phase7_user_a'::uuid \gset
select id as phase7_profile_b from public.profiles
where auth_user_id = :'phase7_user_b'::uuid \gset
select id as phase7_profile_c from public.profiles
where auth_user_id = :'phase7_user_c'::uuid \gset

update public.profiles set onboarding_completed = true
where auth_user_id in (
  :'phase7_user_a'::uuid, :'phase7_user_b'::uuid, :'phase7_user_c'::uuid
);

insert into public.families(
  id, name, slug, created_by, country_of_residence, city, location,
  visibility, discovery_radius_km
) values
  (:'phase7_family_a', 'Support Family A', 'phase7-family-a', :'phase7_profile_a', 'DE', 'Ingolstadt', extensions.st_setsrid(extensions.st_makepoint(11.425, 48.766), 4326)::extensions.geography, 'discoverable', 40),
  (:'phase7_family_b', 'Support Family B', 'phase7-family-b', :'phase7_profile_b', 'DE', 'Ingolstadt', extensions.st_setsrid(extensions.st_makepoint(11.430, 48.766), 4326)::extensions.geography, 'discoverable', 40),
  (:'phase7_family_c', 'Support Family C', 'phase7-family-c', :'phase7_profile_c', 'DE', 'Ingolstadt', extensions.st_setsrid(extensions.st_makepoint(11.435, 48.766), 4326)::extensions.geography, 'discoverable', 40);

insert into public.family_members(family_id, profile_id, role, status) values
  (:'phase7_family_a', :'phase7_profile_a', 'owner', 'active'),
  (:'phase7_family_b', :'phase7_profile_b', 'owner', 'active'),
  (:'phase7_family_c', :'phase7_profile_c', 'owner', 'active');

insert into public.villages(
  id, name, slug, description, village_type, city, center_location, radius_km,
  visibility, created_by_family_id, created_by_profile_id, member_limit
) values (
  :'phase7_village', 'Phase 7 Support Village', 'phase-7-support-village',
  'A private Village for structured mutual-support assertions.', 'local',
  'Ingolstadt',
  extensions.st_setsrid(extensions.st_makepoint(11.425, 48.766), 4326)::extensions.geography,
  40, 'private', :'phase7_family_c', :'phase7_profile_c', 20
);

insert into public.village_members(
  village_id, family_id, role, status, initiated_by_family_id, joined_at
) values
  (:'phase7_village', :'phase7_family_a', 'member', 'active', :'phase7_family_c', now()),
  (:'phase7_village', :'phase7_family_b', 'member', 'active', :'phase7_family_c', now()),
  (:'phase7_village', :'phase7_family_c', 'owner', 'active', :'phase7_family_c', now());

insert into kinavela_private.admin_roles(profile_id, role)
values (:'phase7_profile_c', 'admin');

create function pg_temp.phase7_call_denied(p_operation text, p_post_id uuid default null)
returns boolean language plpgsql as $$
begin
  if p_operation = 'privacy' then
    perform public.create_village_support_post(
      '3aaaaaaa-3333-4333-8333-aaaaaaaaaaaa', 'question', 'kita',
      'Kita application', 'How did your family prepare the general application?', false
    );
  elsif p_operation = 'contact' then
    perform public.create_village_support_post(
      '3aaaaaaa-3333-4333-8333-aaaaaaaaaaaa', 'question', 'kita',
      'Kita application', 'Please email private@example.test with your advice.', true
    );
  elsif p_operation = 'closed_reply' then
    perform public.reply_to_village_support_post(
      p_post_id, 'A reply after resolution should be refused.', true
    );
  end if;
  return false;
exception when others then
  return sqlerrm like case p_operation
    when 'privacy' then '%privacy_confirmation_required%'
    when 'contact' then '%private_contact_details_not_allowed%'
    else '%support_post_not_available%'
  end;
end $$;

select set_config('request.jwt.claim.sub', :'phase7_user_a', true);
select set_config(
  'request.jwt.claims',
  json_build_object('sub', :'phase7_user_a', 'role', 'authenticated')::text,
  true
);
set local role authenticated;
select pg_temp.phase7_call_denied('privacy')::integer as privacy_blocked \gset
select pg_temp.phase7_call_denied('contact')::integer as contact_blocked \gset
select public.create_village_support_post(
  :'phase7_village', 'question', 'kita', 'Preparing a Kita application',
  'Which general municipal resources helped your family prepare?', true
) as support_post_id \gset
reset role;

select set_config('request.jwt.claim.role', 'service_role', true);
set local role service_role;
select (
  jsonb_array_length(
    public.get_personal_data_export_payload(:'phase7_profile_a'::uuid)
      -> 'village_support_posts'
  ) = 1
)::integer as support_exported \gset
reset role;

select count(*)::integer as minimal_notifications
from public.notification_outbox
where entity_id = :'support_post_id'::uuid
  and notification_kind = 'village_activity'
  and entity_type = 'village_support_post'
  and not (payload ? 'title') and not (payload ? 'body')
  and not (payload ? 'address') \gset

select set_config('request.jwt.claim.sub', :'phase7_user_b', true);
select set_config(
  'request.jwt.claims',
  json_build_object('sub', :'phase7_user_b', 'role', 'authenticated')::text,
  true
);
set local role authenticated;
select count(*)::integer as searchable
from public.list_village_support_posts(
  :'phase7_village', 'municipal', 'kita', 'question', 'open', null, 30
) where post_id = :'support_post_id'::uuid \gset
select public.reply_to_village_support_post(
  :'support_post_id'::uuid,
  'The city information portal explained the general process clearly.', true
) as support_reply_id \gset
select public.create_village_support_post(
  :'phase7_village', 'resource', 'local_family_services',
  'Older local family resource',
  'This general resource exists to test removal when information is outdated.', true
) as resource_post_id \gset
select public.submit_village_support_report(
  :'support_post_id'::uuid, null, 'child_safety_concern',
  'The post raises a child-safety concern without copying its content.'
) as support_report_id \gset
reset role;

select set_config('request.jwt.claim.sub', :'phase7_user_a', true);
select set_config(
  'request.jwt.claims',
  json_build_object('sub', :'phase7_user_a', 'role', 'authenticated')::text,
  true
);
set local role authenticated;
select public.close_village_support_post(:'support_post_id'::uuid);
select pg_temp.phase7_call_denied(
  'closed_reply', :'support_post_id'::uuid
)::integer as closed_reply_blocked \gset
reset role;

select count(*)::integer as critical_triage
from public.reports
where id = :'support_report_id'::uuid
  and target_type = 'support_post'
  and target_support_post_id = :'support_post_id'::uuid
  and severity = 'critical' and urgent_child_safety \gset

select set_config('request.jwt.claim.sub', :'phase7_user_c', true);
select set_config(
  'request.jwt.claims',
  json_build_object('sub', :'phase7_user_c', 'role', 'authenticated')::text,
  true
);
set local role authenticated;
select count(*)::integer as moderator_projection
from public.list_village_reports(:'phase7_village')
where report_id = :'support_report_id'::uuid
  and target_support_post_title = 'Preparing a Kita application' \gset
select public.resolve_village_report(
  :'support_report_id'::uuid, 'delete_support_content'
);
select public.moderate_village_support_content(
  :'resource_post_id'::uuid, null, 'outdated'
);
select count(*)::integer as admin_projection
from public.admin_list_reports(null, 100)
where report_id = :'support_report_id'::uuid
  and target_support_post_title = 'Preparing a Kita application'
  and action_count >= 2 \gset
reset role;

select count(*)::integer as direct_moderation
from public.village_support_posts
where id = :'resource_post_id'::uuid and status = 'removed' \gset
select count(*)::integer as tombstoned
from public.village_support_posts
where id = :'support_post_id'::uuid and status = 'removed'
  and removed_at is not null \gset
select count(*)::integer as private_audit_leak
from public.audit_events
where entity_id in (
  :'support_post_id'::uuid, :'support_reply_id'::uuid,
  :'support_report_id'::uuid
) and (
  metadata ? 'title' or metadata ? 'body' or metadata ? 'address'
  or metadata::text like '%municipal resources%'
) \gset

update public.profiles set status = 'deleted'
where id = :'phase7_profile_b'::uuid;
select count(*)::integer as deletion_erased
from public.village_support_replies
where id = :'support_reply_id'::uuid
  and body = '[removed after account deletion]' and removed_at is not null \gset

select (
  :privacy_blocked = 1 and :contact_blocked = 1
  and :support_exported = 1 and :minimal_notifications >= 2 and :searchable = 1
  and :closed_reply_blocked = 1 and :critical_triage = 1
  and :moderator_projection = 1 and :admin_projection = 1
  and :direct_moderation = 1 and :tombstoned = 1
  and :private_audit_leak = 0 and :deletion_erased = 1
)::integer as phase7_valid \gset

select :privacy_blocked as privacy_blocked,
  :contact_blocked as contact_blocked,
  :support_exported as support_exported,
  :minimal_notifications as minimal_notifications,
  :searchable as searchable,
  :closed_reply_blocked as closed_reply_blocked,
  :critical_triage as critical_triage,
  :moderator_projection as moderator_projection,
  :admin_projection as admin_projection,
  :direct_moderation as direct_moderation,
  :tombstoned as tombstoned,
  :private_audit_leak as private_audit_leak,
  :deletion_erased as deletion_erased;
select 1 / :phase7_valid;

rollback;
