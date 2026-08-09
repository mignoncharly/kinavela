\set ON_ERROR_STOP on
begin;

\set user_id 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
insert into auth.users(id, email, raw_user_meta_data, is_sso_user, is_anonymous, email_confirmed_at, created_at, updated_at)
values (:'user_id', 'onboarding-test@kinavela.invalid', '{"display_name":"Onboarding Test"}', false, false, now(), now(), now());

select set_config('request.jwt.claim.sub', :'user_id', true);
select set_config('request.jwt.claims', json_build_object('sub', :'user_id', 'role', 'authenticated')::text, true);
set local role authenticated;

select public.complete_family_onboarding($json$
{
  "display_name":"Onboarding Test",
  "preferred_language":"en",
  "timezone":"Europe/Berlin",
  "family":{"name":"Secure Test Family","country_of_residence":"DE","city":"Berlin","radius_km":35,"visibility":"discoverable","bio":"Atomic onboarding test"},
  "children":[{"nickname":"Little Root","birth_year":2020,"birth_month":5,"gender":null}],
  "culture_ids":["20000000-0000-4000-8000-000000000001"],
  "languages":[{"language_id":"30000000-0000-4000-8000-000000000003","proficiency":"fluent","transmission_goal":"want_to_teach_children"}],
  "preservation_goals":["language","stories"],
  "interest_ids":["40000000-0000-4000-8000-000000000001"],
  "availability":[{"weekday":6,"period":"afternoon"}],
  "preferences":{"open_to_other_african_families":true,"open_to_all_diaspora_families":false,"min_child_age":0,"max_child_age":12}
}
$json$::jsonb) as family_id \gset

select count(*)::integer as completed_count
from public.profiles
where auth_user_id = :'user_id'::uuid and onboarding_completed \gset
select count(*)::integer as child_count
from public.children where family_id = :'family_id'::uuid \gset
select count(*)::integer as owner_count
from public.family_members where family_id = :'family_id'::uuid and role = 'owner' and status = 'active' \gset

\if :completed_count
\else
  \echo 'Onboarding failure: profile was not completed.'
  \quit 1
\endif
\if :child_count
\else
  \echo 'Onboarding failure: child was not created.'
  \quit 1
\endif
\if :owner_count
\else
  \echo 'Onboarding failure: owner membership was not created.'
  \quit 1
\endif

reset role;
rollback;
