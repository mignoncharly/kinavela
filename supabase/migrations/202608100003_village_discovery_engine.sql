begin;

create table public.village_cluster_responses (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  country_id uuid not null references public.countries(id) on delete restrict,
  response text not null check (response in ('dismissed', 'started')),
  village_id uuid references public.villages(id) on delete set null,
  responded_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(family_id, country_id),
  check ((response = 'started' and village_id is not null) or (response = 'dismissed' and village_id is null))
);

create index village_cluster_responses_family_idx
  on public.village_cluster_responses(family_id, response);

create trigger village_cluster_responses_set_updated_at
  before update on public.village_cluster_responses
  for each row execute function public.set_updated_at();

alter table public.village_cluster_responses enable row level security;
alter table public.village_cluster_responses force row level security;
revoke all on public.village_cluster_responses from public, anon, authenticated;

create or replace function kinavela_private.detect_village_clusters(
  p_family_id uuid,
  p_country_id uuid default null
)
returns table (
  country_id uuid,
  country_name text,
  city text,
  family_count integer,
  child_age_ranges text[],
  radius_km integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with requester as (
    select
      f.id,
      f.city,
      f.location,
      f.discovery_radius_km,
      f.visibility
    from public.families f
    where f.id = p_family_id
      and f.location is not null
      and f.visibility = 'discoverable'
  ), origin_countries as (
    select distinct culture.country_id
    from public.family_cultures family_culture
    join public.cultures culture on culture.id = family_culture.culture_id
    where family_culture.family_id = p_family_id
      and family_culture.relationship_type in ('origin', 'heritage')
      and culture.country_id is not null
      and (p_country_id is null or culture.country_id = p_country_id)
  ), compatible_families as (
    select distinct origin.country_id, candidate.id as family_id
    from requester
    cross join origin_countries origin
    join public.families candidate on candidate.visibility = 'discoverable'
      and candidate.location is not null
      and extensions.st_dwithin(
        requester.location,
        candidate.location,
        least(30, requester.discovery_radius_km, candidate.discovery_radius_km) * 1000.0
      )
    join public.family_cultures candidate_family_culture
      on candidate_family_culture.family_id = candidate.id
      and candidate_family_culture.relationship_type in ('origin', 'heritage')
    join public.cultures candidate_culture
      on candidate_culture.id = candidate_family_culture.culture_id
      and candidate_culture.country_id = origin.country_id
    where exists (
      select 1
      from public.family_members member
      join public.profiles profile on profile.id = member.profile_id
      where member.family_id = candidate.id
        and member.status = 'active'
        and profile.status = 'active'
    )
      and not exists (
        select 1
        from public.discovery_blocks block
        where (block.blocker_family_id = p_family_id and block.blocked_family_id = candidate.id)
           or (block.blocked_family_id = p_family_id and block.blocker_family_id = candidate.id)
      )
      and exists (
        select 1
        from public.children candidate_child
        where candidate_child.family_id = candidate.id
          and exists (
            select 1
            from public.children requester_child
            where requester_child.family_id = p_family_id
              and abs(
                extract(year from age(current_date, make_date(candidate_child.birth_year, coalesce(candidate_child.birth_month, 7), 1)))::integer
                - extract(year from age(current_date, make_date(requester_child.birth_year, coalesce(requester_child.birth_month, 7), 1)))::integer
              ) <= 3
          )
      )
  ), compatible_ages as (
    select distinct compatible.country_id,
      case
        when child_age <= 2 then '0-2'
        when child_age <= 5 then '3-5'
        when child_age <= 8 then '6-8'
        when child_age <= 12 then '9-12'
        when child_age <= 15 then '13-15'
        when child_age <= 18 then '16-18'
        else '18+'
      end as age_range
    from compatible_families compatible
    join public.children candidate_child on candidate_child.family_id = compatible.family_id
    cross join lateral (
      select extract(year from age(
        current_date,
        make_date(candidate_child.birth_year, coalesce(candidate_child.birth_month, 7), 1)
      ))::integer as child_age
    ) age
    where exists (
      select 1
      from public.children requester_child
      where requester_child.family_id = p_family_id
        and abs(
          age.child_age
          - extract(year from age(current_date, make_date(requester_child.birth_year, coalesce(requester_child.birth_month, 7), 1)))::integer
        ) <= 3
    )
  ), aggregated as (
    select
      compatible.country_id,
      count(distinct compatible.family_id)::integer as family_count,
      array_agg(distinct compatible_age.age_range order by compatible_age.age_range) as child_age_ranges
    from compatible_families compatible
    join compatible_ages compatible_age on compatible_age.country_id = compatible.country_id
    group by compatible.country_id
  )
  select
    country.id,
    country.name,
    requester.city,
    aggregated.family_count,
    aggregated.child_age_ranges,
    30
  from aggregated
  join public.countries country on country.id = aggregated.country_id
  cross join requester
  where aggregated.family_count >= 7
    and cardinality(aggregated.child_age_ranges) >= 3
    and not exists (
      select 1
      from public.villages village
      where village.status = 'active'
        and village.country_focus_id = aggregated.country_id
        and extensions.st_dwithin(requester.location, village.center_location, 30000.0)
    )
  order by aggregated.family_count desc, country.name;
$$;

revoke all on function kinavela_private.detect_village_clusters(uuid, uuid)
  from public, anon, authenticated, service_role;

create or replace function public.list_village_cluster_recommendations()
returns table (
  country_id uuid,
  country_name text,
  city text,
  family_count integer,
  child_age_ranges text[],
  radius_km integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  profile_uuid uuid := public.current_profile_id();
  family_uuid uuid := kinavela_private.current_family_id(true);
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  if family_uuid is null then raise exception 'not_authorized'; end if;

  return query
  select cluster.country_id, cluster.country_name, cluster.city,
    cluster.family_count, cluster.child_age_ranges, cluster.radius_km
  from kinavela_private.detect_village_clusters(family_uuid, null) cluster
  where not exists (
    select 1
    from public.village_cluster_responses response
    where response.family_id = family_uuid
      and response.country_id = cluster.country_id
  );
end;
$$;

create or replace function public.dismiss_village_cluster_recommendation(p_country_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_uuid uuid := public.current_profile_id();
  family_uuid uuid := kinavela_private.current_family_id(true);
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  if family_uuid is null then raise exception 'not_authorized'; end if;
  if not exists (
    select 1
    from kinavela_private.detect_village_clusters(family_uuid, p_country_id)
  ) then raise exception 'recommendation_not_available'; end if;

  insert into public.village_cluster_responses(
    family_id, country_id, response, village_id, responded_by_profile_id
  ) values (family_uuid, p_country_id, 'dismissed', null, profile_uuid)
  on conflict(family_id, country_id) do update
    set response = 'dismissed', village_id = null,
      responded_by_profile_id = profile_uuid, updated_at = now();

  insert into public.audit_events(actor_profile_id, event_type, entity_type, entity_id)
  values (profile_uuid, 'village_recommendation_dismissed', 'country', p_country_id);
  return true;
end;
$$;

create or replace function public.start_village_cluster_recommendation(
  p_country_id uuid,
  p_name text,
  p_description text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_uuid uuid := public.current_profile_id();
  family_uuid uuid := kinavela_private.current_family_id(true);
  village_uuid uuid;
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  if family_uuid is null then raise exception 'not_authorized'; end if;

  perform pg_advisory_xact_lock(hashtextextended('village-cluster:' || p_country_id::text, 0));
  if not exists (
    select 1
    from kinavela_private.detect_village_clusters(family_uuid, p_country_id)
  ) then raise exception 'recommendation_not_available'; end if;
  if exists (
    select 1
    from public.village_cluster_responses response
    where response.family_id = family_uuid
      and response.country_id = p_country_id
  ) then raise exception 'recommendation_already_responded'; end if;

  village_uuid := public.create_village(
    p_name,
    p_description,
    'culture',
    p_country_id,
    30,
    'listed',
    30
  );

  insert into public.village_cluster_responses(
    family_id, country_id, response, village_id, responded_by_profile_id
  ) values (family_uuid, p_country_id, 'started', village_uuid, profile_uuid);
  insert into public.audit_events(actor_profile_id, event_type, entity_type, entity_id, metadata)
  values (
    profile_uuid,
    'village_recommendation_started',
    'village',
    village_uuid,
    jsonb_build_object('country_id', p_country_id)
  );
  return village_uuid;
end;
$$;

revoke all on function public.list_village_cluster_recommendations(),
  public.dismiss_village_cluster_recommendation(uuid),
  public.start_village_cluster_recommendation(uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.list_village_cluster_recommendations(),
  public.dismiss_village_cluster_recommendation(uuid),
  public.start_village_cluster_recommendation(uuid, text, text)
  to authenticated;

insert into kinavela_private.schema_migrations(version)
values ('202608100003_village_discovery_engine') on conflict(version) do nothing;

notify pgrst, 'reload schema';
commit;
