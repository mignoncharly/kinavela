\set ON_ERROR_STOP on
begin;

do $$
begin
  if to_regprocedure('public.list_connection_child_summaries()') is null then
    raise exception 'connected child summary RPC is missing';
  end if;
  if not has_function_privilege(
    'authenticated', 'public.list_connection_child_summaries()', 'execute'
  ) then
    raise exception 'authenticated child summary access is missing';
  end if;
  if has_function_privilege(
    'anon', 'public.list_connection_child_summaries()', 'execute'
  ) then
    raise exception 'anonymous child summary access exists';
  end if;
  if pg_get_function_result(
    'public.list_connection_child_summaries()'::regprocedure
  ) <> 'TABLE(connection_id uuid, child_nickname text, age_range text)' then
    raise exception 'child summary exposes an unexpected projection: %',
      pg_get_function_result(
        'public.list_connection_child_summaries()'::regprocedure
      );
  end if;
end
$$;

\set child_viewer_user 'eaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
\set child_connected_user 'ebbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
\set child_unconnected_user 'eccccccc-cccc-4ccc-8ccc-cccccccccccc'
\set child_viewer_family 'eaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
\set child_connected_family 'ebbbbbbb-2222-4222-8222-bbbbbbbbbbbb'
\set child_unconnected_family 'eccccccc-3333-4333-8333-cccccccccccc'
\set child_connection 'eddddddd-4444-4444-8444-dddddddddddd'

insert into auth.users(
  id, email, raw_user_meta_data, is_sso_user, is_anonymous,
  email_confirmed_at, created_at, updated_at
)
values
  (:'child_viewer_user', 'child-viewer@kinavela.invalid', '{"display_name":"Child Viewer"}', false, false, now(), now(), now()),
  (:'child_connected_user', 'child-connected@kinavela.invalid', '{"display_name":"Connected Parent"}', false, false, now(), now(), now()),
  (:'child_unconnected_user', 'child-unconnected@kinavela.invalid', '{"display_name":"Unconnected Parent"}', false, false, now(), now(), now());

select id as child_viewer_profile
from public.profiles where auth_user_id = :'child_viewer_user'::uuid \gset
select id as child_connected_profile
from public.profiles where auth_user_id = :'child_connected_user'::uuid \gset
select id as child_unconnected_profile
from public.profiles where auth_user_id = :'child_unconnected_user'::uuid \gset

insert into public.families(
  id, name, slug, created_by, country_of_residence, city
)
values
  (:'child_viewer_family', 'Viewer Family', 'child-viewer-family', :'child_viewer_profile', 'DE', 'Berlin'),
  (:'child_connected_family', 'Connected Family', 'child-connected-family', :'child_connected_profile', 'DE', 'Potsdam'),
  (:'child_unconnected_family', 'Unconnected Family', 'child-unconnected-family', :'child_unconnected_profile', 'DE', 'Leipzig');

insert into public.family_members(family_id, profile_id, role, status)
values
  (:'child_viewer_family', :'child_viewer_profile', 'owner', 'active'),
  (:'child_connected_family', :'child_connected_profile', 'owner', 'active'),
  (:'child_unconnected_family', :'child_unconnected_profile', 'owner', 'active');

insert into public.children(family_id, nickname, birth_year, birth_month, gender, visibility)
values
  (:'child_connected_family', 'Visible nickname', extract(year from current_date)::integer - 4, 6, 'female', 'connections'),
  (:'child_connected_family', 'Private nickname', extract(year from current_date)::integer - 7, 5, 'male', 'guardians'),
  (:'child_unconnected_family', 'Unknown nickname', extract(year from current_date)::integer - 4, 4, null, 'connections');

insert into public.family_connections(
  id, requester_family_id, recipient_family_id, status,
  status_changed_by_family_id, responded_at, accepted_at
)
values (
  :'child_connection', :'child_viewer_family', :'child_connected_family',
  'accepted', :'child_connected_family', now(), now()
);

select set_config('request.jwt.claim.sub', :'child_viewer_user', true);
select set_config(
  'request.jwt.claims',
  json_build_object('sub', :'child_viewer_user', 'role', 'authenticated')::text,
  true
);
set local role authenticated;

select 1 / ((count(*) = 1)::integer)
from public.list_connection_child_summaries()
where connection_id = :'child_connection'::uuid
  and child_nickname = 'Visible nickname'
  and age_range = '3-5';

select 1 / ((count(*) = 0)::integer)
from public.list_connection_child_summaries()
where child_nickname in ('Private nickname', 'Unknown nickname');

reset role;

insert into public.discovery_blocks(
  blocker_family_id, blocked_family_id, created_by
)
values (
  :'child_connected_family', :'child_viewer_family', :'child_connected_profile'
);

set local role authenticated;
select 1 / ((count(*) = 0)::integer)
from public.list_connection_child_summaries();

reset role;
rollback;
