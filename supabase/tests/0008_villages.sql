\set ON_ERROR_STOP on
begin;

do $$
declare table_name text; rls_enabled boolean; rls_forced boolean;
begin
  foreach table_name in array array['villages', 'village_members', 'village_moderation_actions'] loop
    select relrowsecurity, relforcerowsecurity into rls_enabled, rls_forced
    from pg_class where oid = format('public.%I', table_name)::regclass;
    if not rls_enabled or not rls_forced then raise exception 'Village RLS missing on %', table_name; end if;
  end loop;
  if has_table_privilege('authenticated', 'public.villages', 'insert')
     or has_table_privilege('authenticated', 'public.village_members', 'update')
     or has_table_privilege('authenticated', 'public.village_moderation_actions', 'insert') then
    raise exception 'Village tables exceed least privilege';
  end if;
  if has_function_privilege('anon', 'public.create_village(text,text,text,uuid,integer,text,integer)', 'execute')
     or has_function_privilege('authenticated', 'kinavela_private.can_access_village(uuid,boolean)', 'execute')
     or has_function_privilege('authenticated', 'kinavela_private.activate_village_family(uuid,uuid)', 'execute') then
    raise exception 'Village routine grants exceed least privilege';
  end if;
  if pg_get_function_result('public.discover_villages()'::regprocedure) ~* '(location|profile|auth_user|email)'
     or pg_get_function_result('public.get_village(uuid)'::regprocedure) ~* '(location|profile|auth_user|email)' then
    raise exception 'Village projection exposes sensitive fields';
  end if;
end
$$;

\set village_user_a 'a3aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
\set village_user_b 'b3bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
\set village_user_c 'c3cccccc-cccc-4ccc-8ccc-cccccccccccc'
\set village_user_d 'd3dddddd-dddd-4ddd-8ddd-dddddddddddd'
\set village_family_a 'a3aaaaaa-1111-4111-8111-aaaaaaaaaaaa'
\set village_family_b 'b3bbbbbb-2222-4222-8222-bbbbbbbbbbbb'
\set village_family_c 'c3cccccc-3333-4333-8333-cccccccccccc'
\set village_family_d 'd3dddddd-4444-4444-8444-dddddddddddd'

insert into auth.users(id, email, raw_user_meta_data, is_sso_user, is_anonymous, created_at, updated_at) values
  (:'village_user_a', 'village-a@kinavela.invalid', '{"display_name":"Village A"}', false, false, now(), now()),
  (:'village_user_b', 'village-b@kinavela.invalid', '{"display_name":"Village B"}', false, false, now(), now()),
  (:'village_user_c', 'village-c@kinavela.invalid', '{"display_name":"Village C"}', false, false, now(), now()),
  (:'village_user_d', 'village-d@kinavela.invalid', '{"display_name":"Village D"}', false, false, now(), now());

select id as village_profile_a from public.profiles where auth_user_id = :'village_user_a'::uuid \gset
select id as village_profile_b from public.profiles where auth_user_id = :'village_user_b'::uuid \gset
select id as village_profile_c from public.profiles where auth_user_id = :'village_user_c'::uuid \gset
select id as village_profile_d from public.profiles where auth_user_id = :'village_user_d'::uuid \gset

insert into public.families(id, name, slug, created_by, country_of_residence, city, location, discovery_radius_km) values
  (:'village_family_a', 'Village Family A', 'village-family-a', :'village_profile_a', 'DE', 'Berlin', extensions.st_setsrid(extensions.st_makepoint(13.405, 52.520), 4326)::extensions.geography, 40),
  (:'village_family_b', 'Village Family B', 'village-family-b', :'village_profile_b', 'DE', 'Berlin', extensions.st_setsrid(extensions.st_makepoint(13.410, 52.522), 4326)::extensions.geography, 40),
  (:'village_family_c', 'Village Family C', 'village-family-c', :'village_profile_c', 'DE', 'Potsdam', extensions.st_setsrid(extensions.st_makepoint(13.300, 52.500), 4326)::extensions.geography, 40),
  (:'village_family_d', 'Village Family D', 'village-family-d', :'village_profile_d', 'DE', 'Munich', extensions.st_setsrid(extensions.st_makepoint(11.582, 48.135), 4326)::extensions.geography, 40);
insert into public.family_members(family_id, profile_id, role, status) values
  (:'village_family_a', :'village_profile_a', 'owner', 'active'),
  (:'village_family_b', :'village_profile_b', 'owner', 'active'),
  (:'village_family_c', :'village_profile_c', 'owner', 'active'),
  (:'village_family_d', :'village_profile_d', 'owner', 'active');
insert into public.family_connections(requester_family_id, recipient_family_id, status, status_changed_by_family_id, responded_at, accepted_at)
values (:'village_family_a', :'village_family_b', 'accepted', :'village_family_b', now(), now());

create function pg_temp.village_call_denied(p_operation text, p_village_id uuid, p_family_id uuid default null)
returns boolean language plpgsql as $$
begin
  case p_operation
    when 'role' then perform public.set_village_member_role(p_village_id, p_family_id, 'owner');
    when 'messages' then perform 1 from public.list_village_messages(p_village_id, null, 50);
    when 'leave' then perform public.leave_village(p_village_id);
  end case;
  return false;
exception when others then return true;
end;
$$;

select set_config('request.jwt.claim.sub', :'village_user_a', true);
select set_config('request.jwt.claims', json_build_object('sub', :'village_user_a', 'role', 'authenticated')::text, true);
set local role authenticated;
select public.create_village('Cameroon Families Berlin', 'A trusted local community for families to share culture.', 'local', null, 40, 'listed', 30) as village_id \gset
select count(*)::integer as owner_projection from public.get_village(:'village_id'::uuid) where member_role = 'owner' and member_count = 1 and can_manage_roles \gset
select public.invite_family_to_village(:'village_id'::uuid, :'village_family_b'::uuid);
select pg_temp.village_call_denied('leave', :'village_id'::uuid)::integer as owner_leave_denied \gset
reset role;

select set_config('request.jwt.claim.sub', :'village_user_b', true);
select set_config('request.jwt.claims', json_build_object('sub', :'village_user_b', 'role', 'authenticated')::text, true);
set local role authenticated;
select count(*)::integer as invitation_count from public.list_village_invitations() where village_id = :'village_id'::uuid \gset
select public.respond_village_invitation(:'village_id'::uuid, true);
select pg_temp.village_call_denied('role', :'village_id'::uuid, :'village_family_b'::uuid)::integer as self_promotion_denied \gset
reset role;

select set_config('request.jwt.claim.sub', :'village_user_c', true);
select set_config('request.jwt.claims', json_build_object('sub', :'village_user_c', 'role', 'authenticated')::text, true);
set local role authenticated;
select count(*)::integer as discover_count from public.discover_villages() where village_id = :'village_id'::uuid \gset
select public.request_village_membership(:'village_id'::uuid);
reset role;

select set_config('request.jwt.claim.sub', :'village_user_a', true);
select set_config('request.jwt.claims', json_build_object('sub', :'village_user_a', 'role', 'authenticated')::text, true);
set local role authenticated;
select count(*)::integer as request_count from public.list_village_membership_requests(:'village_id'::uuid) where family_id = :'village_family_c'::uuid \gset
select public.respond_village_join_request(:'village_id'::uuid, :'village_family_c'::uuid, true);
select count(*)::integer as three_members from public.list_village_members(:'village_id'::uuid) \gset
select public.set_village_member_role(:'village_id'::uuid, :'village_family_b'::uuid, 'moderator');
reset role;

select (:owner_projection = 1 and :owner_leave_denied = 1 and :invitation_count = 1 and :self_promotion_denied = 1 and :discover_count = 1 and :request_count = 1 and :three_members = 3)::integer as formation_valid \gset
\if :formation_valid
\else
  \echo 'Village failure: three-family formation or governance invariants failed.'
  select 1 / 0;
\endif

select set_config('request.jwt.claim.sub', :'village_user_c', true);
select set_config('request.jwt.claims', json_build_object('sub', :'village_user_c', 'role', 'authenticated')::text, true);
set local role authenticated;
select public.send_village_message(:'village_id'::uuid, '  Welcome to our Village  ', null) as village_message_id \gset
reset role;

select set_config('request.jwt.claim.sub', :'village_user_b', true);
select set_config('request.jwt.claims', json_build_object('sub', :'village_user_b', 'role', 'authenticated')::text, true);
set local role authenticated;
select count(*)::integer as message_count from public.list_village_messages(:'village_id'::uuid, null, 50) where message_id = :'village_message_id'::uuid and body = 'Welcome to our Village' \gset
select public.submit_village_report(:'village_id'::uuid, :'village_message_id'::uuid, 'harassment', 'Test report') as village_report_id \gset
select count(*)::integer as moderation_count from public.list_village_reports(:'village_id'::uuid) where report_id = :'village_report_id'::uuid \gset
select public.resolve_village_report(:'village_report_id'::uuid, 'delete_message');
select public.remove_village_member(:'village_id'::uuid, :'village_family_c'::uuid);
reset role;

select set_config('request.jwt.claim.sub', :'village_user_c', true);
select set_config('request.jwt.claims', json_build_object('sub', :'village_user_c', 'role', 'authenticated')::text, true);
set local role authenticated;
select pg_temp.village_call_denied('messages', :'village_id'::uuid)::integer as removed_access_denied \gset
reset role;

select set_config('request.jwt.claim.sub', :'village_user_d', true);
select set_config('request.jwt.claims', json_build_object('sub', :'village_user_d', 'role', 'authenticated')::text, true);
set local role authenticated;
select pg_temp.village_call_denied('messages', :'village_id'::uuid)::integer as nonmember_rpc_denied \gset
select count(*)::integer as nonmember_direct_messages from public.messages where conversation_id = (select id from public.conversations where village_id = :'village_id'::uuid) \gset
reset role;

select (:message_count = 1 and :moderation_count = 1 and :removed_access_denied = 1 and :nonmember_rpc_denied = 1 and :nonmember_direct_messages = 0)::integer as privacy_valid \gset
\if :privacy_valid
\else
  \echo 'Village failure: chat moderation or non-member privacy failed.'
  select 1 / 0;
\endif

rollback;
