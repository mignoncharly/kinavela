\set ON_ERROR_STOP on
begin;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'discovery_alert_subscriptions',
    'discovery_alert_matches',
    'discovery_alert_batches'
  ] loop
    if not exists (
      select 1 from pg_class relation
      join pg_namespace namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public' and relation.relname = table_name
        and relation.relrowsecurity and relation.relforcerowsecurity
    ) then raise exception 'Discovery alert table % must use forced RLS', table_name; end if;
  end loop;
  if has_table_privilege('authenticated', 'public.discovery_alert_subscriptions', 'select')
     or has_table_privilege('authenticated', 'public.discovery_alert_matches', 'select')
     or has_table_privilege('authenticated', 'public.discovery_alert_batches', 'select') then
    raise exception 'Discovery alert internals must remain RPC-only';
  end if;
  if has_function_privilege('authenticated', 'public.dispatch_compatible_family_alerts()', 'execute')
     or not has_function_privilege('service_role', 'public.dispatch_compatible_family_alerts()', 'execute')
     or not has_function_privilege('authenticated', 'public.update_my_discovery_alert(boolean,integer)', 'execute') then
    raise exception 'Discovery alert function grants violate least privilege';
  end if;
  if pg_get_function_result('public.get_my_discovery_alert()'::regprocedure)
       ~* '(family|candidate|profile|location|email|phone|child)' then
    raise exception 'Discovery alert projection exposes identity or location data';
  end if;
end $$;

\set alert_user_a '1aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
\set alert_user_g '1bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
\set alert_user_b '1ccccccc-cccc-4ccc-8ccc-cccccccccccc'
\set alert_user_c '1ddddddd-dddd-4ddd-8ddd-dddddddddddd'
\set alert_user_d '1eeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
\set alert_user_e '1fffffff-ffff-4fff-8fff-ffffffffffff'
\set alert_family_a '2aaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
\set alert_family_b '2bbbbbbb-2222-4222-8222-bbbbbbbbbbbb'
\set alert_family_c '2ccccccc-3333-4333-8333-cccccccccccc'
\set alert_family_d '2ddddddd-4444-4444-8444-dddddddddddd'
\set alert_family_e '2eeeeeee-5555-4555-8555-eeeeeeeeeeee'

insert into auth.users(id, email, raw_user_meta_data, is_sso_user, is_anonymous, created_at, updated_at) values
  (:'alert_user_a', 'alert-a@kinavela.invalid', '{"display_name":"Alert A"}', false, false, now(), now()),
  (:'alert_user_g', 'alert-g@kinavela.invalid', '{"display_name":"Alert Guardian"}', false, false, now(), now()),
  (:'alert_user_b', 'alert-b@kinavela.invalid', '{"display_name":"Alert B"}', false, false, now(), now()),
  (:'alert_user_c', 'alert-c@kinavela.invalid', '{"display_name":"Alert C"}', false, false, now(), now()),
  (:'alert_user_d', 'alert-d@kinavela.invalid', '{"display_name":"Alert D"}', false, false, now(), now()),
  (:'alert_user_e', 'alert-e@kinavela.invalid', '{"display_name":"Alert E"}', false, false, now(), now());

select id as alert_profile_a from public.profiles where auth_user_id = :'alert_user_a'::uuid \gset
select id as alert_profile_g from public.profiles where auth_user_id = :'alert_user_g'::uuid \gset
select id as alert_profile_b from public.profiles where auth_user_id = :'alert_user_b'::uuid \gset
select id as alert_profile_c from public.profiles where auth_user_id = :'alert_user_c'::uuid \gset
select id as alert_profile_d from public.profiles where auth_user_id = :'alert_user_d'::uuid \gset
select id as alert_profile_e from public.profiles where auth_user_id = :'alert_user_e'::uuid \gset

insert into public.families(
  id, name, slug, created_by, country_of_residence, city,
  location, discovery_radius_km, visibility
) values
  (:'alert_family_a', 'Alert Family A', 'alert-family-a', :'alert_profile_a', 'DE', 'Berlin', extensions.st_setsrid(extensions.st_makepoint(13.405, 52.520), 4326)::extensions.geography, 40, 'discoverable'),
  (:'alert_family_b', 'Alert Family B', 'alert-family-b', :'alert_profile_b', 'DE', 'Berlin', extensions.st_setsrid(extensions.st_makepoint(13.415, 52.524), 4326)::extensions.geography, 10, 'discoverable'),
  (:'alert_family_c', 'Alert Family C', 'alert-family-c', :'alert_profile_c', 'DE', 'Leipzig', extensions.st_setsrid(extensions.st_makepoint(12.373, 51.340), 4326)::extensions.geography, 100, 'discoverable'),
  (:'alert_family_d', 'Alert Family D', 'alert-family-d', :'alert_profile_d', 'DE', 'Berlin', extensions.st_setsrid(extensions.st_makepoint(13.420, 52.526), 4326)::extensions.geography, 40, 'discoverable'),
  (:'alert_family_e', 'Alert Family E', 'alert-family-e', :'alert_profile_e', 'DE', 'Berlin', extensions.st_setsrid(extensions.st_makepoint(13.425, 52.528), 4326)::extensions.geography, 40, 'private');
insert into public.family_members(family_id, profile_id, role, status) values
  (:'alert_family_a', :'alert_profile_a', 'owner', 'active'),
  (:'alert_family_a', :'alert_profile_g', 'guardian', 'active'),
  (:'alert_family_b', :'alert_profile_b', 'owner', 'active'),
  (:'alert_family_c', :'alert_profile_c', 'owner', 'active'),
  (:'alert_family_d', :'alert_profile_d', 'owner', 'active'),
  (:'alert_family_e', :'alert_profile_e', 'owner', 'active');

insert into public.children(family_id, nickname, birth_year, visibility) values
  (:'alert_family_a', 'A child', 2020, 'connections'),
  (:'alert_family_b', 'B child', 2020, 'connections'),
  (:'alert_family_c', 'C child', 2020, 'connections'),
  (:'alert_family_d', 'D child', 2020, 'connections'),
  (:'alert_family_e', 'E child', 2020, 'connections');
insert into public.family_cultures(family_id, culture_id, relationship_type, priority) values
  (:'alert_family_a', '20000000-0000-4000-8000-000000000001', 'origin', 1),
  (:'alert_family_b', '20000000-0000-4000-8000-000000000001', 'origin', 1),
  (:'alert_family_c', '20000000-0000-4000-8000-000000000001', 'origin', 1),
  (:'alert_family_d', '20000000-0000-4000-8000-000000000001', 'origin', 1),
  (:'alert_family_e', '20000000-0000-4000-8000-000000000001', 'origin', 1);

insert into public.discovery_blocks(blocker_family_id, blocked_family_id, created_by)
values (:'alert_family_a', :'alert_family_d', :'alert_profile_a');

create function pg_temp.alert_call_denied(p_radius integer)
returns boolean language plpgsql as $$
begin
  perform public.update_my_discovery_alert(true, p_radius);
  return false;
exception when others then
  return position(
    case when p_radius > 40 then 'invalid_alert_radius' else 'owner_required' end
    in sqlerrm
  ) > 0;
end $$;

create function pg_temp.alert_direct_denied()
returns boolean language plpgsql as $$
begin
  perform 1 from public.discovery_alert_subscriptions;
  return false;
exception when insufficient_privilege then
  return true;
end $$;

select set_config('request.jwt.claim.sub', :'alert_user_a', true);
select set_config('request.jwt.claims', json_build_object('sub', :'alert_user_a', 'role', 'authenticated')::text, true);
set local role authenticated;
select pg_temp.alert_call_denied(50)::integer as max_radius_enforced \gset
select public.update_my_discovery_alert(true, 40) as alert_subscription_id \gset
select count(*)::integer as owner_projection from public.get_my_discovery_alert()
where subscription_id = :'alert_subscription_id'::uuid and active and radius_km = 40 \gset
select pg_temp.alert_direct_denied()::integer as direct_denied \gset
reset role;

select set_config('request.jwt.claim.sub', :'alert_user_g', true);
select set_config('request.jwt.claims', json_build_object('sub', :'alert_user_g', 'role', 'authenticated')::text, true);
set local role authenticated;
select pg_temp.alert_call_denied(40)::integer as guardian_denied \gset
reset role;

select set_config('request.jwt.claim.role', 'service_role', true);
select public.dispatch_compatible_family_alerts() as first_batches \gset
select count(*)::integer as first_matches from public.discovery_alert_matches
where subscription_id = :'alert_subscription_id'::uuid \gset
select count(*)::integer as candidate_b_matched from public.discovery_alert_matches
where subscription_id = :'alert_subscription_id'::uuid
  and candidate_family_id = :'alert_family_b'::uuid \gset
select count(*)::integer as excluded_candidates from public.discovery_alert_matches
where subscription_id = :'alert_subscription_id'::uuid
  and candidate_family_id in (
    :'alert_family_c'::uuid, :'alert_family_d'::uuid, :'alert_family_e'::uuid
  ) \gset
select count(*)::integer as safe_outbox from public.notification_outbox
where recipient_profile_id = :'alert_profile_a'::uuid
  and notification_kind = 'compatible_family_available'
  and channel = 'in_app'
  and payload = '{"match_count": 1, "radius_km": 40}'::jsonb
  and not (payload ?| array[
    'candidate_family_id', 'family_id', 'family_name', 'city', 'location'
  ]) \gset
select public.dispatch_compatible_family_alerts() as duplicate_batches \gset
select count(*)::integer as matches_after_repeat from public.discovery_alert_matches
where subscription_id = :'alert_subscription_id'::uuid \gset

select set_config('request.jwt.claim.sub', :'alert_user_a', true);
select set_config('request.jwt.claims', json_build_object('sub', :'alert_user_a', 'role', 'authenticated')::text, true);
set local role authenticated;
select public.update_my_discovery_alert(false, null);
reset role;
delete from public.discovery_blocks
where blocker_family_id = :'alert_family_a'::uuid
  and blocked_family_id = :'alert_family_d'::uuid;
select set_config('request.jwt.claim.role', 'service_role', true);
select public.dispatch_compatible_family_alerts() as revoked_batches \gset

select set_config('request.jwt.claim.sub', :'alert_user_a', true);
select set_config('request.jwt.claims', json_build_object('sub', :'alert_user_a', 'role', 'authenticated')::text, true);
set local role authenticated;
select public.update_my_discovery_alert(true, 40);
reset role;
select set_config('request.jwt.claim.role', 'service_role', true);
select public.dispatch_compatible_family_alerts() as reenabled_batches \gset
select count(*)::integer as final_matches from public.discovery_alert_matches
where subscription_id = :'alert_subscription_id'::uuid \gset
select count(*)::integer as candidate_b_once from public.discovery_alert_matches
where subscription_id = :'alert_subscription_id'::uuid
  and candidate_family_id = :'alert_family_b'::uuid \gset
select count(*)::integer as candidate_d_once from public.discovery_alert_matches
where subscription_id = :'alert_subscription_id'::uuid
  and candidate_family_id = :'alert_family_d'::uuid \gset

select (
  :max_radius_enforced = 1 and :owner_projection = 1 and :direct_denied = 1
  and :guardian_denied = 1 and :first_batches = 1 and :first_matches = 1
  and :candidate_b_matched = 1 and :excluded_candidates = 0
  and :safe_outbox = 1 and :duplicate_batches = 0
  and :matches_after_repeat = 1 and :revoked_batches = 0
  and :reenabled_batches = 1 and :final_matches = 2
  and :candidate_b_once = 1 and :candidate_d_once = 1
)::integer as discovery_alerts_valid \gset
\if :discovery_alerts_valid
\else
  \echo 'Phase 5 failure: discovery alert privacy, radius, block, ownership, deduplication, or revocation assertion failed.'
  select 1 / 0;
\endif

rollback;
