\set ON_ERROR_STOP on
begin;

do $$
declare
  table_name text;
  rls_enabled boolean;
  rls_forced boolean;
begin
  foreach table_name in array array[
    'family_connections', 'connection_request_attempts', 'notifications'
  ] loop
    select relrowsecurity, relforcerowsecurity into rls_enabled, rls_forced
    from pg_class where oid = format('public.%I', table_name)::regclass;
    if not rls_enabled or not rls_forced then
      raise exception 'RLS is not enabled and forced on public.%', table_name;
    end if;
  end loop;

  if has_table_privilege('authenticated', 'public.connection_request_attempts', 'select')
     or has_table_privilege('authenticated', 'public.family_connections', 'insert')
     or has_table_privilege('authenticated', 'public.family_connections', 'update')
     or has_table_privilege('authenticated', 'public.notifications', 'insert') then
    raise exception 'Connection tables exceed least privilege.';
  end if;
  if has_function_privilege('anon', 'public.request_family_connection(uuid)', 'execute')
     or has_function_privilege('anon', 'public.respond_family_connection(uuid,boolean)', 'execute')
     or has_function_privilege('anon', 'public.list_family_connections()', 'execute')
     or has_function_privilege('authenticated', 'kinavela_private.families_are_connected(uuid,uuid)', 'execute') then
    raise exception 'Connection RPC grants exceed least privilege.';
  end if;
  if pg_get_function_result('public.list_family_connections()'::regprocedure)
     ~* '(email|auth_user|location|nickname|birth_year|avatar_path)' then
    raise exception 'Connection listing return type exposes a sensitive field.';
  end if;
end
$$;

\set connection_user_a 'a1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
\set connection_user_b 'b1bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
\set connection_user_c 'c1cccccc-cccc-4ccc-8ccc-cccccccccccc'
\set connection_family_a 'a1aaaaaa-1111-4111-8111-aaaaaaaaaaaa'
\set connection_family_b 'b1bbbbbb-2222-4222-8222-bbbbbbbbbbbb'
\set connection_family_c 'c1cccccc-3333-4333-8333-cccccccccccc'

insert into auth.users(id, email, raw_user_meta_data, is_sso_user, is_anonymous, created_at, updated_at)
values
  (:'connection_user_a', 'connection-a@kinavela.invalid', '{"display_name":"Guardian A"}', false, false, now(), now()),
  (:'connection_user_b', 'connection-b@kinavela.invalid', '{"display_name":"Guardian B"}', false, false, now(), now()),
  (:'connection_user_c', 'connection-c@kinavela.invalid', '{"display_name":"Guardian C"}', false, false, now(), now());

select id as connection_profile_a from public.profiles where auth_user_id = :'connection_user_a'::uuid \gset
select id as connection_profile_b from public.profiles where auth_user_id = :'connection_user_b'::uuid \gset
select id as connection_profile_c from public.profiles where auth_user_id = :'connection_user_c'::uuid \gset

insert into public.families(
  id, name, slug, created_by, country_of_residence, city, location,
  discovery_radius_km, bio
)
values
  (:'connection_family_a', 'Connection Family A', 'connection-family-a', :'connection_profile_a', 'DE', 'Berlin', extensions.st_setsrid(extensions.st_makepoint(13.4050, 52.5200), 4326)::extensions.geography, 40, 'Private bio A'),
  (:'connection_family_b', 'Connection Family B', 'connection-family-b', :'connection_profile_b', 'DE', 'Potsdam', extensions.st_setsrid(extensions.st_makepoint(13.3000, 52.5000), 4326)::extensions.geography, 40, 'Private bio B'),
  (:'connection_family_c', 'Connection Family C', 'connection-family-c', :'connection_profile_c', 'DE', 'Berlin', extensions.st_setsrid(extensions.st_makepoint(13.4100, 52.5200), 4326)::extensions.geography, 40, 'Private bio C');

insert into public.family_members(family_id, profile_id, role, status)
values
  (:'connection_family_a', :'connection_profile_a', 'owner', 'active'),
  (:'connection_family_b', :'connection_profile_b', 'owner', 'active'),
  (:'connection_family_c', :'connection_profile_c', 'owner', 'active');

create function pg_temp.connection_response_is_denied(p_connection_id uuid)
returns boolean
language plpgsql
as $$
begin
  perform public.respond_family_connection(p_connection_id, true);
  return false;
exception when others then
  return true;
end;
$$;

select set_config('request.jwt.claim.sub', :'connection_user_a', true);
select set_config('request.jwt.claims', json_build_object('sub', :'connection_user_a', 'role', 'authenticated')::text, true);
set local role authenticated;

select public.request_family_connection(:'connection_family_b'::uuid) as connection_id \gset
select count(*)::integer as outgoing_safe_count
from public.list_family_connections()
where connection_id = :'connection_id'::uuid
  and other_family_id = :'connection_family_b'::uuid
  and status = 'requested'
  and direction = 'outgoing'
  and bio is null
  and cardinality(guardian_names) = 0 \gset
\if :outgoing_safe_count
\else
  \echo 'Connection failure: outgoing request exposed accepted-only data or has the wrong state.'
  \quit 1
\endif

select pg_temp.connection_response_is_denied(:'connection_id'::uuid)::integer as unauthorized_response_blocked \gset
\if :unauthorized_response_blocked
\else
  \echo 'Connection failure: requester was able to accept its own request.'
  \quit 1
\endif

reset role;
select set_config('request.jwt.claim.sub', :'connection_user_b', true);
select set_config('request.jwt.claims', json_build_object('sub', :'connection_user_b', 'role', 'authenticated')::text, true);
set local role authenticated;

select count(*)::integer as incoming_count
from public.list_family_connections()
where connection_id = :'connection_id'::uuid
  and direction = 'incoming' and status = 'requested' and bio is null \gset
select count(*)::integer as request_notification_count
from public.list_notifications(30)
where connection_id = :'connection_id'::uuid
  and notification_type = 'connection_request'
  and actor_family_id = :'connection_family_a'::uuid \gset
select (:incoming_count = 1 and :request_notification_count = 1)::integer as pending_valid \gset
\if :pending_valid
\else
  \echo 'Connection failure: recipient did not receive one safe pending request and notification.'
  \quit 1
\endif

select public.respond_family_connection(:'connection_id'::uuid, true);
select count(*)::integer as accepted_privacy_count
from public.list_family_connections()
where connection_id = :'connection_id'::uuid
  and status = 'accepted'
  and direction = 'incoming'
  and bio = 'Private bio A'
  and guardian_names = array['Guardian A']::text[] \gset
select public.are_families_connected(:'connection_family_a'::uuid)::integer as connected_b \gset
select (:accepted_privacy_count = 1 and :connected_b = 1)::integer as accepted_valid \gset
\if :accepted_valid
\else
  \echo 'Connection failure: acceptance did not open the intended limited family details.'
  \quit 1
\endif

reset role;
select set_config('request.jwt.claim.sub', :'connection_user_a', true);
select set_config('request.jwt.claims', json_build_object('sub', :'connection_user_a', 'role', 'authenticated')::text, true);
set local role authenticated;

select count(*)::integer as acceptance_notification_count
from public.list_notifications(30)
where connection_id = :'connection_id'::uuid
  and notification_type = 'connection_accepted'
  and actor_family_id = :'connection_family_b'::uuid \gset
select public.are_families_connected(:'connection_family_b'::uuid)::integer as connected_a \gset
select (:acceptance_notification_count = 1 and :connected_a = 1)::integer as mutual_valid \gset
\if :mutual_valid
\else
  \echo 'Connection failure: mutual connection or acceptance notification is missing.'
  \quit 1
\endif

select public.set_discovery_block(:'connection_family_b'::uuid, true);
select public.are_families_connected(:'connection_family_b'::uuid)::integer as connected_after_block \gset
select count(*)::integer as listed_after_block
from public.list_family_connections()
where connection_id = :'connection_id'::uuid \gset
select (:connected_after_block = 0 and :listed_after_block = 0)::integer as block_valid \gset
\if :block_valid
\else
  \echo 'Connection failure: block did not immediately supersede acceptance.'
  \quit 1
\endif

select public.set_discovery_block(:'connection_family_b'::uuid, false);
select public.are_families_connected(:'connection_family_b'::uuid)::integer as connected_after_unblock \gset
\if :connected_after_unblock
  \echo 'Connection failure: unblock silently restored an accepted relationship.'
  \quit 1
\endif

reset role;
select set_config('request.jwt.claim.sub', :'connection_user_c', true);
select set_config('request.jwt.claims', json_build_object('sub', :'connection_user_c', 'role', 'authenticated')::text, true);
set local role authenticated;
select count(*)::integer as unrelated_connection_rows
from public.family_connections
where id = :'connection_id'::uuid \gset
select count(*)::integer as unrelated_notification_rows
from public.notifications
where connection_id = :'connection_id'::uuid \gset
select (:unrelated_connection_rows = 0 and :unrelated_notification_rows = 0)::integer as cross_family_valid \gset
\if :cross_family_valid
\else
  \echo 'Connection failure: unrelated family bypassed connection or notification RLS.'
  \quit 1
\endif

reset role;
rollback;
