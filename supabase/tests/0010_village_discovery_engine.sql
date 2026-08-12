\set ON_ERROR_STOP on
begin;

do $$
begin
  if not exists (
    select 1
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'village_cluster_responses'
      and relation.relrowsecurity
      and relation.relforcerowsecurity
  ) then raise exception 'Village cluster responses must use forced RLS'; end if;
  if has_table_privilege('authenticated', 'public.village_cluster_responses', 'select')
     or has_table_privilege('authenticated', 'public.village_cluster_responses', 'insert') then
    raise exception 'Village cluster responses must remain RPC-only';
  end if;
  if has_function_privilege(
       'anon', 'public.list_village_cluster_recommendations()', 'execute'
     ) or has_function_privilege(
       'authenticated', 'kinavela_private.detect_village_clusters(uuid,uuid)', 'execute'
     ) then
    raise exception 'Village cluster routine grants are too broad';
  end if;
  if pg_get_function_result(
       'public.list_village_cluster_recommendations()'::regprocedure
     ) ~* '(family_id|profile|location|email|coordinate|longitude|latitude)' then
    raise exception 'Village cluster projection exposes sensitive fields';
  end if;
end
$$;

insert into auth.users(
  id, email, raw_user_meta_data, is_sso_user, is_anonymous, created_at, updated_at
)
select
  ('90000000-0000-4000-8000-' || lpad(number::text, 12, '0'))::uuid,
  'phase9-family-' || number || '@kinavela.invalid',
  jsonb_build_object('display_name', 'Phase 9 Guardian ' || number),
  false,
  false,
  now(),
  now()
from generate_series(1, 7) number;

insert into public.families(
  id, name, slug, created_by, country_of_residence, city, location,
  discovery_radius_km, visibility
)
select
  ('91000000-0000-4000-8000-' || lpad(number::text, 12, '0'))::uuid,
  'Phase 9 Family ' || number,
  'phase-9-family-' || number,
  profile.id,
  'DE',
  'Ingolstadt',
  extensions.st_setsrid(
    extensions.st_makepoint(11.42 + number * 0.005, 48.76 + number * 0.002),
    4326
  )::extensions.geography,
  30,
  'discoverable'
from generate_series(1, 7) number
join public.profiles profile
  on profile.auth_user_id = (
    '90000000-0000-4000-8000-' || lpad(number::text, 12, '0')
  )::uuid;

insert into public.family_members(family_id, profile_id, role, status)
select
  family.id,
  profile.id,
  'owner',
  'active'
from public.families family
join public.profiles profile on profile.id = family.created_by
where family.slug like 'phase-9-family-%';

insert into public.discovery_preferences(family_id, radius_km)
select id, 30
from public.families
where slug like 'phase-9-family-%';

insert into public.family_cultures(family_id, culture_id, relationship_type, priority)
select id, '20000000-0000-4000-8000-000000000001'::uuid, 'origin', 5
from public.families
where slug like 'phase-9-family-%';

insert into public.children(family_id, nickname, birth_year, birth_month)
select
  ('91000000-0000-4000-8000-' || lpad(number::text, 12, '0'))::uuid,
  'Child ' || number,
  extract(year from current_date)::integer - case number % 3
    when 1 then 2
    when 2 then 5
    else 8
  end,
  7
from generate_series(1, 7) number;

insert into public.children(family_id, nickname, birth_year, birth_month) values
  ('91000000-0000-4000-8000-000000000001', 'Older sibling', extract(year from current_date)::integer - 5, 7),
  ('91000000-0000-4000-8000-000000000001', 'Oldest sibling', extract(year from current_date)::integer - 8, 7);

select set_config(
  'request.jwt.claim.sub',
  '90000000-0000-4000-8000-000000000001',
  true
);
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '90000000-0000-4000-8000-000000000001',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;

select count(*)::integer as recommendation_count,
  min(family_count)::integer as detected_families,
  min(cardinality(child_age_ranges))::integer as detected_age_ranges
from public.list_village_cluster_recommendations()
where country_id = '10000000-0000-4000-8000-000000000001'::uuid
  and city = 'Ingolstadt'
  and radius_km = 30
\gset

reset role;
select count(*)::integer as village_count_before_consent
from public.villages
where created_by_family_id = '91000000-0000-4000-8000-000000000001'::uuid
\gset

set local role authenticated;
select public.dismiss_village_cluster_recommendation(
  '10000000-0000-4000-8000-000000000001'::uuid
);
select count(*)::integer as recommendation_count_after_dismiss
from public.list_village_cluster_recommendations()
\gset

reset role;
delete from public.village_cluster_responses
where family_id = '91000000-0000-4000-8000-000000000001'::uuid;

set local role authenticated;
select public.start_village_cluster_recommendation(
  '10000000-0000-4000-8000-000000000001'::uuid,
  'Cameroon Families · Ingolstadt',
  'A private local community for Cameroon families around Ingolstadt.'
) as phase9_village_id
\gset
reset role;

select count(*)::integer as started_village_count
from public.villages village
join public.village_members member on member.village_id = village.id
where village.id = :'phase9_village_id'::uuid
  and village.country_focus_id = '10000000-0000-4000-8000-000000000001'::uuid
  and village.village_type = 'culture'
  and village.radius_km = 30
  and village.visibility = 'listed'
  and member.family_id = '91000000-0000-4000-8000-000000000001'::uuid
  and member.role = 'owner'
  and member.status = 'active'
\gset

select (
  :recommendation_count = 1
  and :detected_families = 7
  and :detected_age_ranges >= 3
  and :village_count_before_consent = 0
  and :recommendation_count_after_dismiss = 0
  and :started_village_count = 1
)::integer as recommendation_flow_valid
\gset
\if :recommendation_flow_valid
\else
  \echo 'Phase 9 failure: aggregate detection, consent, or Village start invariant failed.'
  select 1 / 0;
\endif

select set_config(
  'request.jwt.claim.sub',
  '90000000-0000-4000-8000-000000000002',
  true
);
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '90000000-0000-4000-8000-000000000002',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;
select count(*)::integer as recommendation_count_with_active_village
from public.list_village_cluster_recommendations()
\gset
reset role;

select (:recommendation_count_with_active_village = 0)::integer as active_village_suppression_valid
\gset
\if :active_village_suppression_valid
\else
  \echo 'Phase 9 failure: an existing active cultural Village did not suppress the cluster.'
  select 1 / 0;
\endif

rollback;
