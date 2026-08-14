\set ON_ERROR_STOP on
begin;

do $$
declare table_name text;
begin
  foreach table_name in array array['invitation_links', 'invitation_claims'] loop
    if not exists (
      select 1 from pg_class relation
      join pg_namespace namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public' and relation.relname = table_name
        and relation.relrowsecurity and relation.relforcerowsecurity
    ) then raise exception 'Invitation table % must use forced RLS', table_name; end if;
  end loop;
  if has_table_privilege('authenticated', 'public.invitation_links', 'select')
     or has_table_privilege('anon', 'public.invitation_links', 'select')
     or has_table_privilege('authenticated', 'public.invitation_claims', 'insert') then
    raise exception 'Invitation tables must remain RPC-only';
  end if;
  if not has_function_privilege('anon', 'public.get_public_invitation(text)', 'execute')
     or has_function_privilege('anon', 'public.create_invitation_link(text,uuid,uuid,text)', 'execute')
     or has_function_privilege('authenticated', 'kinavela_private.invitation_digest(text)', 'execute') then
    raise exception 'Invitation function grants violate least privilege';
  end if;
  if pg_get_function_result('public.get_public_invitation(text)'::regprocedure)
       ~* '(address|location|coordinate|profile|family|email|phone|child)' then
    raise exception 'Public invitation projection exposes sensitive fields';
  end if;
end $$;

\set invite_user_a 'a9aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
\set invite_user_b 'b9bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
\set invite_user_c 'c9cccccc-cccc-4ccc-8ccc-cccccccccccc'
\set invite_user_d 'd9dddddd-dddd-4ddd-8ddd-dddddddddddd'
\set invite_user_e 'e9eeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
\set invite_user_g 'f9ffffff-ffff-4fff-8fff-ffffffffffff'
\set invite_family_a 'a9aaaaaa-1111-4111-8111-aaaaaaaaaaaa'
\set invite_family_b 'b9bbbbbb-2222-4222-8222-bbbbbbbbbbbb'
\set invite_family_c 'c9cccccc-3333-4333-8333-cccccccccccc'
\set invite_family_d 'd9dddddd-4444-4444-8444-dddddddddddd'
\set invite_family_e 'e9eeeeee-5555-4555-8555-eeeeeeeeeeee'

insert into auth.users(id, email, raw_user_meta_data, is_sso_user, is_anonymous, created_at, updated_at) values
  (:'invite_user_a', 'invite-a@kinavela.invalid', '{"display_name":"Invite A"}', false, false, now(), now()),
  (:'invite_user_b', 'invite-b@kinavela.invalid', '{"display_name":"Invite B"}', false, false, now(), now()),
  (:'invite_user_c', 'invite-c@kinavela.invalid', '{"display_name":"Invite C"}', false, false, now(), now()),
  (:'invite_user_d', 'invite-d@kinavela.invalid', '{"display_name":"Invite D"}', false, false, now(), now()),
  (:'invite_user_e', 'invite-e@kinavela.invalid', '{"display_name":"Invite E"}', false, false, now(), now()),
  (:'invite_user_g', 'invite-g@kinavela.invalid', '{"display_name":"Invite Guardian"}', false, false, now(), now());

select id as invite_profile_a from public.profiles where auth_user_id = :'invite_user_a'::uuid \gset
select id as invite_profile_b from public.profiles where auth_user_id = :'invite_user_b'::uuid \gset
select id as invite_profile_c from public.profiles where auth_user_id = :'invite_user_c'::uuid \gset
select id as invite_profile_d from public.profiles where auth_user_id = :'invite_user_d'::uuid \gset
select id as invite_profile_e from public.profiles where auth_user_id = :'invite_user_e'::uuid \gset
select id as invite_profile_g from public.profiles where auth_user_id = :'invite_user_g'::uuid \gset

insert into public.families(id, name, slug, created_by, country_of_residence, city, location, discovery_radius_km) values
  (:'invite_family_a', 'Invite Family A', 'invite-family-a', :'invite_profile_a', 'DE', 'Berlin', extensions.st_setsrid(extensions.st_makepoint(13.405, 52.520), 4326)::extensions.geography, 40),
  (:'invite_family_b', 'Invite Family B', 'invite-family-b', :'invite_profile_b', 'DE', 'Berlin', extensions.st_setsrid(extensions.st_makepoint(13.410, 52.522), 4326)::extensions.geography, 40),
  (:'invite_family_c', 'Invite Family C', 'invite-family-c', :'invite_profile_c', 'DE', 'Berlin', extensions.st_setsrid(extensions.st_makepoint(13.415, 52.524), 4326)::extensions.geography, 40),
  (:'invite_family_d', 'Invite Family D', 'invite-family-d', :'invite_profile_d', 'DE', 'Berlin', extensions.st_setsrid(extensions.st_makepoint(13.420, 52.526), 4326)::extensions.geography, 40),
  (:'invite_family_e', 'Invite Family E', 'invite-family-e', :'invite_profile_e', 'DE', 'Munich', extensions.st_setsrid(extensions.st_makepoint(11.582, 48.135), 4326)::extensions.geography, 40);
insert into public.family_members(family_id, profile_id, role, status) values
  (:'invite_family_a', :'invite_profile_a', 'owner', 'active'),
  (:'invite_family_b', :'invite_profile_b', 'owner', 'active'),
  (:'invite_family_c', :'invite_profile_c', 'owner', 'active'),
  (:'invite_family_c', :'invite_profile_g', 'guardian', 'active'),
  (:'invite_family_d', :'invite_profile_d', 'owner', 'active'),
  (:'invite_family_e', :'invite_profile_e', 'owner', 'active');
insert into public.family_connections(
  requester_family_id, recipient_family_id, status,
  status_changed_by_family_id, responded_at, accepted_at
) values (
  :'invite_family_a', :'invite_family_b', 'accepted',
  :'invite_family_b', now(), now()
);

create function pg_temp.invitation_call_denied(p_operation text, p_token text, p_expected text)
returns boolean language plpgsql as $$
begin
  case p_operation
    when 'create' then perform 1 from public.create_invitation_link('village', p_token::uuid, null, 'en');
    when 'accept' then perform 1 from public.accept_village_invitation_link(p_token);
  end case;
  return false;
exception when others then return position(p_expected in sqlerrm) > 0;
end $$;

select set_config('request.jwt.claim.sub', :'invite_user_a', true);
select set_config('request.jwt.claims', json_build_object('sub', :'invite_user_a', 'role', 'authenticated')::text, true);
set local role authenticated;
select public.create_village(
  'Cameroon Families Berlin',
  'A trusted local Village for invitation security acceptance tests.',
  'local', null, 40, 'listed', 3
) as invite_village_id \gset
select public.invite_family_to_village(:'invite_village_id'::uuid, :'invite_family_b'::uuid);
reset role;

select set_config('request.jwt.claim.sub', :'invite_user_b', true);
select set_config('request.jwt.claims', json_build_object('sub', :'invite_user_b', 'role', 'authenticated')::text, true);
set local role authenticated;
select public.respond_village_invitation(:'invite_village_id'::uuid, true);
reset role;

select set_config('request.jwt.claim.sub', :'invite_user_a', true);
select set_config('request.jwt.claims', json_build_object('sub', :'invite_user_a', 'role', 'authenticated')::text, true);
set local role authenticated;
select public.create_village_event(
  :'invite_village_id', 'Private-address picnic',
  'An event invitation whose exact address must never become public.',
  'picnic', now() + interval '5 days', now() + interval '5 days 3 hours',
  'Community Park', 'Berlin', 'Secret Park Gate 9, Berlin', 'A park in Berlin',
  'going', 20, now() + interval '4 days'
) as invite_event_id \gset
select * from public.create_invitation_link('family_referral', null, null, 'en') \gset referral_
select * from public.create_invitation_link('village', :'invite_village_id', :'invite_event_id', 'en') \gset village_
select * from public.create_invitation_link('family_referral', null, null, 'de') \gset expired_
reset role;

select count(*)::integer as token_storage_safe
from public.invitation_links
where id in (:'referral_invitation_id'::uuid, :'village_invitation_id'::uuid)
  and token_digest <> :'referral_raw_token'
  and token_digest <> :'village_raw_token'
  and token_digest ~ '^[a-f0-9]{64}$' \gset

set local role anon;
select count(*)::integer as public_event_projection
from public.get_public_invitation(:'village_raw_token')
where invitation_kind = 'village'
  and village_name = 'Cameroon Families Berlin'
  and village_city = 'Berlin'
  and event_title = 'Private-address picnic' \gset
select count(*)::integer as referral_projection
from public.get_public_invitation(:'referral_raw_token')
where invitation_kind = 'family_referral' and village_name is null
  and village_city is null and country_focus_name is null
  and event_title is null and event_starts_at is null \gset
reset role;

select set_config('request.jwt.claim.sub', :'invite_user_b', true);
select set_config('request.jwt.claims', json_build_object('sub', :'invite_user_b', 'role', 'authenticated')::text, true);
set local role authenticated;
select pg_temp.invitation_call_denied('create', :'invite_village_id', 'not_authorized')::integer as member_create_denied \gset
reset role;

select set_config('request.jwt.claim.sub', :'invite_user_g', true);
select set_config('request.jwt.claims', json_build_object('sub', :'invite_user_g', 'role', 'authenticated')::text, true);
set local role authenticated;
select pg_temp.invitation_call_denied('accept', :'village_raw_token', 'owner_required')::integer as guardian_denied \gset
reset role;

select set_config('request.jwt.claim.sub', :'invite_user_e', true);
select set_config('request.jwt.claims', json_build_object('sub', :'invite_user_e', 'role', 'authenticated')::text, true);
set local role authenticated;
select pg_temp.invitation_call_denied('accept', :'village_raw_token', 'geographic_eligibility_required')::integer as far_denied \gset
reset role;

insert into public.discovery_blocks(blocker_family_id, blocked_family_id, created_by)
values (:'invite_family_b', :'invite_family_c', :'invite_profile_b');
select set_config('request.jwt.claim.sub', :'invite_user_c', true);
select set_config('request.jwt.claims', json_build_object('sub', :'invite_user_c', 'role', 'authenticated')::text, true);
set local role authenticated;
select pg_temp.invitation_call_denied('accept', :'village_raw_token', 'village_not_available')::integer as blocked_denied \gset
reset role;
delete from public.discovery_blocks
where blocker_family_id = :'invite_family_b'::uuid and blocked_family_id = :'invite_family_c'::uuid;

select set_config('request.jwt.claim.sub', :'invite_user_c', true);
select set_config('request.jwt.claims', json_build_object('sub', :'invite_user_c', 'role', 'authenticated')::text, true);
set local role authenticated;
select * from public.accept_village_invitation_link(:'village_raw_token') \gset accepted_
reset role;
select count(*)::integer as accepted_membership from public.village_members
where village_id = :'invite_village_id'::uuid and family_id = :'invite_family_c'::uuid
  and status = 'active' \gset
select count(*)::integer as accepted_participants from public.conversation_participants participant
join public.conversations conversation on conversation.id = participant.conversation_id
where conversation.village_id = :'invite_village_id'::uuid
  and participant.family_id = :'invite_family_c'::uuid \gset

select set_config('request.jwt.claim.sub', :'invite_user_d', true);
select set_config('request.jwt.claims', json_build_object('sub', :'invite_user_d', 'role', 'authenticated')::text, true);
set local role authenticated;
select pg_temp.invitation_call_denied('accept', :'village_raw_token', 'village_full')::integer as capacity_denied \gset
select public.record_referral_attribution(:'referral_raw_token');
reset role;
select count(*)::integer as referral_claimed from public.invitation_claims
where invitation_link_id = :'referral_invitation_id'::uuid
  and claimed_by_family_id = :'invite_family_d'::uuid
  and outcome = 'referral_onboarded' \gset

select set_config('request.jwt.claim.sub', :'invite_user_a', true);
select set_config('request.jwt.claims', json_build_object('sub', :'invite_user_a', 'role', 'authenticated')::text, true);
set local role authenticated;
select public.revoke_invitation_link(:'referral_invitation_id');
reset role;
set local role anon;
select count(*)::integer as revoked_hidden from public.get_public_invitation(:'referral_raw_token') \gset
reset role;

update public.invitation_links
set created_at = now() - interval '2 days', expires_at = now() - interval '1 day'
where id = :'expired_invitation_id'::uuid;
set local role anon;
select count(*)::integer as expired_hidden from public.get_public_invitation(:'expired_raw_token') \gset
reset role;

select (
  :token_storage_safe = 2 and :public_event_projection = 1
  and :referral_projection = 1 and :member_create_denied = 1
  and :guardian_denied = 1 and :far_denied = 1 and :blocked_denied = 1
  and :'accepted_village_id' = :'invite_village_id'
  and :'accepted_event_id' = :'invite_event_id'
  and :accepted_membership = 1 and :accepted_participants >= 1
  and :capacity_denied = 1 and :referral_claimed = 1
  and :revoked_hidden = 0 and :expired_hidden = 0
)::integer as invitations_valid \gset
\if :invitations_valid
\else
  \echo 'Phase 4 failure: invitation privacy, authorization, acceptance, revocation, or expiry assertion failed.'
  select 1 / 0;
\endif

rollback;
