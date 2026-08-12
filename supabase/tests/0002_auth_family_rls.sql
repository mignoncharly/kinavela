\set ON_ERROR_STOP on
begin;

do $$
declare
  table_name text;
  rls_enabled boolean;
  rls_forced boolean;
begin
  foreach table_name in array array[
    'profiles', 'consents', 'audit_events', 'account_deletion_requests',
    'countries', 'cultures', 'languages', 'interests', 'families',
    'family_members', 'children', 'family_cultures', 'family_languages',
    'family_interests', 'family_availability', 'discovery_preferences'
  ] loop
    select relrowsecurity, relforcerowsecurity into rls_enabled, rls_forced
    from pg_class where oid = format('public.%I', table_name)::regclass;
    if not rls_enabled or not rls_forced then
      raise exception 'RLS is not enabled and forced on public.%', table_name;
    end if;
  end loop;
end
$$;

\set user_a 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
\set user_b 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
\set user_c 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
\set family_a 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
\set family_b 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb'
\set child_b 'bbbbbbbb-3333-4333-8333-bbbbbbbbbbbb'

insert into auth.users(id, email, raw_user_meta_data, is_sso_user, is_anonymous, created_at, updated_at)
values
  (:'user_a', 'rls-a@kinavela.invalid', '{"display_name":"RLS A"}', false, false, now(), now()),
  (:'user_b', 'rls-b@kinavela.invalid', '{"display_name":"RLS B"}', false, false, now(), now()),
  (:'user_c', 'rls-c@kinavela.invalid', '{"display_name":"RLS C"}', false, false, now(), now());

select id as profile_a from public.profiles where auth_user_id = :'user_a'::uuid \gset
select id as profile_b from public.profiles where auth_user_id = :'user_b'::uuid \gset
select id as profile_c from public.profiles where auth_user_id = :'user_c'::uuid \gset

insert into public.families(id, name, slug, created_by, country_of_residence, city)
values
  (:'family_a', 'RLS Family A', 'rls-family-a', :'profile_a', 'DE', 'Berlin'),
  (:'family_b', 'RLS Family B', 'rls-family-b', :'profile_b', 'DE', 'Hamburg');

insert into public.family_members(family_id, profile_id, role, status)
values
  (:'family_a', :'profile_a', 'owner', 'active'),
  (:'family_b', :'profile_b', 'owner', 'active'),
  (:'family_b', :'profile_c', 'guardian', 'active');

insert into public.children(id, family_id, nickname, birth_year)
values (:'child_b', :'family_b', 'Private child', 2020);

select set_config('request.jwt.claim.sub', :'user_a', true);
select set_config('request.jwt.claims', json_build_object('sub', :'user_a', 'role', 'authenticated')::text, true);
set local role authenticated;

select count(*)::integer as own_family_count from public.families where id = :'family_a' \gset
select count(*)::integer as other_family_count from public.families where id = :'family_b' \gset
select count(*)::integer as other_child_count from public.children where id = :'child_b' \gset

\if :own_family_count
\else
  \echo 'RLS failure: Family A cannot read its own family.'
  \quit 1
\endif
\if :other_family_count
  \echo 'RLS failure: Family A can read Family B.'
  \quit 1
\endif
\if :other_child_count
  \echo 'RLS failure: Family A can read Family B child data.'
  \quit 1
\endif

reset role;
select set_config('request.jwt.claim.sub', :'user_c', true);
select set_config('request.jwt.claims', json_build_object('sub', :'user_c', 'role', 'authenticated')::text, true);
set local role authenticated;

with changed as (
  update public.family_members
  set role = 'owner'
  where family_id = :'family_b' and profile_id = :'profile_c'
  returning 1
)
select count(*)::integer as promoted_count from changed \gset

\if :promoted_count
  \echo 'RLS failure: a guardian promoted itself to owner.'
  \quit 1
\endif

reset role;
do $$
begin
  if has_table_privilege('anon', 'public.families', 'select') then
    raise exception 'RLS failure: anonymous users have family table privileges.';
  end if;
end
$$;

reset role;
rollback;
