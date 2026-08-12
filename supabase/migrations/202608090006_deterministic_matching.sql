begin;

create or replace function kinavela_private.calculate_family_match(
  p_requester_family_id uuid,
  p_candidate_family_id uuid,
  p_distance_km numeric,
  p_radius_km integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  distance_score integer;
  child_age_score integer := 0;
  culture_score integer := 0;
  language_score integer := 0;
  interest_score integer := 0;
  availability_score integer := 0;
  preference_score integer := 0;
  minimum_age_gap integer;
  intersection_count integer;
  union_count integer;
  child_weight numeric;
  culture_weight numeric;
  language_weight numeric;
  interest_weight numeric;
  availability_weight numeric;
  preference_weight numeric;
  total_weight numeric;
  total_score integer;
  requester_open_african boolean;
  requester_open_all boolean;
  candidate_open_african boolean;
  candidate_open_all boolean;
  shared_origin_country boolean;
begin
  if p_requester_family_id = p_candidate_family_id
     or p_distance_km < 0
     or p_radius_km not between 5 and 100 then
    raise exception 'invalid_match_input';
  end if;

  distance_score := round(greatest(0, least(100, (1 - (p_distance_km / p_radius_km)) * 100)));

  select min(abs(
    extract(year from age(current_date, make_date(requester_child.birth_year, coalesce(requester_child.birth_month, 7), 1)))::integer -
    extract(year from age(current_date, make_date(candidate_child.birth_year, coalesce(candidate_child.birth_month, 7), 1)))::integer
  )) into minimum_age_gap
  from public.children requester_child
  cross join public.children candidate_child
  where requester_child.family_id = p_requester_family_id
    and candidate_child.family_id = p_candidate_family_id;
  if minimum_age_gap is not null then
    child_age_score := greatest(0, 100 - minimum_age_gap * 20);
  end if;

  select count(*) into intersection_count from (
    select culture_id from public.family_cultures where family_id = p_requester_family_id
    intersect
    select culture_id from public.family_cultures where family_id = p_candidate_family_id
  ) shared;
  select count(*) into union_count from (
    select culture_id from public.family_cultures where family_id = p_requester_family_id
    union
    select culture_id from public.family_cultures where family_id = p_candidate_family_id
  ) combined;
  if union_count > 0 then culture_score := round(intersection_count * 100.0 / union_count); end if;

  select count(*) into intersection_count from (
    select language_id from public.family_languages where family_id = p_requester_family_id
    intersect
    select language_id from public.family_languages where family_id = p_candidate_family_id
  ) shared;
  select count(*) into union_count from (
    select language_id from public.family_languages where family_id = p_requester_family_id
    union
    select language_id from public.family_languages where family_id = p_candidate_family_id
  ) combined;
  if union_count > 0 then language_score := round(intersection_count * 100.0 / union_count); end if;

  select count(*) into intersection_count from (
    select interest_id from public.family_interests where family_id = p_requester_family_id
    intersect
    select interest_id from public.family_interests where family_id = p_candidate_family_id
  ) shared;
  select count(*) into union_count from (
    select interest_id from public.family_interests where family_id = p_requester_family_id
    union
    select interest_id from public.family_interests where family_id = p_candidate_family_id
  ) combined;
  if union_count > 0 then interest_score := round(intersection_count * 100.0 / union_count); end if;

  select count(*) into intersection_count from (
    select weekday, period from public.family_availability where family_id = p_requester_family_id
    intersect
    select weekday, period from public.family_availability where family_id = p_candidate_family_id
  ) shared;
  select count(*) into union_count from (
    select weekday, period from public.family_availability where family_id = p_requester_family_id
    union
    select weekday, period from public.family_availability where family_id = p_candidate_family_id
  ) combined;
  if union_count > 0 then availability_score := round(intersection_count * 100.0 / union_count); end if;

  select exists (
    select 1
    from public.family_cultures requester_culture
    join public.cultures requester_catalogue on requester_catalogue.id = requester_culture.culture_id
    join public.family_cultures candidate_culture on candidate_culture.family_id = p_candidate_family_id
    join public.cultures candidate_catalogue on candidate_catalogue.id = candidate_culture.culture_id
      and candidate_catalogue.country_id = requester_catalogue.country_id
    where requester_culture.family_id = p_requester_family_id
      and requester_catalogue.country_id is not null
  ) into shared_origin_country;

  select
    coalesce(requester.open_to_other_african_families, false),
    coalesce(requester.open_to_all_diaspora_families, false),
    coalesce(candidate.open_to_other_african_families, false),
    coalesce(candidate.open_to_all_diaspora_families, false)
  into requester_open_african, requester_open_all, candidate_open_african, candidate_open_all
  from public.discovery_preferences requester
  cross join public.discovery_preferences candidate
  where requester.family_id = p_requester_family_id
    and candidate.family_id = p_candidate_family_id;

  preference_score := case
    when shared_origin_country then 100
    when requester_open_all and candidate_open_all then 75
    when requester_open_african and candidate_open_african then 50
    else 0
  end;

  select
    20 * coalesce(similar_child_age_priority, 4) / 5.0,
    15 * coalesce(same_culture_priority, 4) / 5.0,
    10 * coalesce(same_language_priority, 3) / 5.0,
    15 * coalesce(shared_interests_priority, 3) / 5.0,
    10 * coalesce(availability_priority, 2) / 5.0,
    5 * coalesce(same_country_priority, 4) / 5.0
  into child_weight, culture_weight, language_weight, interest_weight,
    availability_weight, preference_weight
  from public.discovery_preferences
  where family_id = p_requester_family_id;

  child_weight := coalesce(child_weight, 16);
  culture_weight := coalesce(culture_weight, 12);
  language_weight := coalesce(language_weight, 6);
  interest_weight := coalesce(interest_weight, 9);
  availability_weight := coalesce(availability_weight, 4);
  preference_weight := coalesce(preference_weight, 4);
  total_weight := 25 + child_weight + culture_weight + language_weight +
    interest_weight + availability_weight + preference_weight;
  total_score := round((
    distance_score * 25 +
    child_age_score * child_weight +
    culture_score * culture_weight +
    language_score * language_weight +
    interest_score * interest_weight +
    availability_score * availability_weight +
    preference_score * preference_weight
  ) / total_weight);

  return jsonb_build_object(
    'score', total_score,
    'components', jsonb_build_object(
      'distance', distance_score,
      'child_age', child_age_score,
      'culture', culture_score,
      'language', language_score,
      'interests', interest_score,
      'availability', availability_score,
      'preferences', preference_score
    ),
    'weights', jsonb_build_object(
      'distance', 25,
      'child_age', child_weight,
      'culture', culture_weight,
      'language', language_weight,
      'interests', interest_weight,
      'availability', availability_weight,
      'preferences', preference_weight
    )
  );
end;
$$;

revoke all on function kinavela_private.calculate_family_match(uuid, uuid, numeric, integer)
  from public, anon, authenticated, service_role;

create or replace function public.match_families(
  p_radius_km integer default null,
  p_country_code text default null,
  p_culture_ids uuid[] default null,
  p_language_ids uuid[] default null,
  p_interest_ids uuid[] default null,
  p_min_child_age integer default null,
  p_max_child_age integer default null,
  p_weekday integer default null,
  p_period text default null,
  p_limit integer default 30,
  p_offset integer default 0
)
returns table (
  family_id uuid,
  family_name text,
  display_city text,
  distance_bucket text,
  match_score smallint,
  child_age_ranges text[],
  cultures text[],
  languages text[],
  shared_interests text[],
  compatibility_reasons text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  requester_profile uuid := public.current_profile_id();
  requester_family public.families%rowtype;
  effective_radius integer;
begin
  if requester_profile is null then raise exception 'not_authenticated'; end if;
  select f.* into requester_family
  from public.families f
  join public.family_members fm on fm.family_id = f.id
  where fm.profile_id = requester_profile and fm.status = 'active'
  order by fm.created_at
  limit 1;
  if requester_family.id is null then raise exception 'family_not_found'; end if;
  if requester_family.location is null then raise exception 'location_required'; end if;
  if p_radius_km is not null and p_radius_km not between 5 and 100 then raise exception 'invalid_radius'; end if;
  if p_country_code is not null and upper(p_country_code) !~ '^[A-Z]{2}$' then raise exception 'invalid_country'; end if;
  if p_min_child_age is not null and p_min_child_age not between 0 and 20 then raise exception 'invalid_age'; end if;
  if p_max_child_age is not null and p_max_child_age not between 0 and 20 then raise exception 'invalid_age'; end if;
  if p_min_child_age is not null and p_max_child_age is not null and p_min_child_age > p_max_child_age then raise exception 'invalid_age'; end if;
  if (p_weekday is null) <> (p_period is null) then raise exception 'invalid_availability'; end if;
  if p_weekday is not null and (p_weekday not between 0 and 6 or p_period not in ('morning', 'afternoon', 'evening')) then raise exception 'invalid_availability'; end if;
  if coalesce(cardinality(p_culture_ids), 0) > 20
     or coalesce(cardinality(p_language_ids), 0) > 20
     or coalesce(cardinality(p_interest_ids), 0) > 20 then raise exception 'invalid_filters'; end if;
  if p_limit not between 1 and 50 or p_offset not between 0 and 1000 then raise exception 'invalid_pagination'; end if;
  effective_radius := least(coalesce(p_radius_km, requester_family.discovery_radius_km), requester_family.discovery_radius_km);

  return query
  with candidates as (
    select f.*,
      extensions.st_distance(requester_family.location, f.location) / 1000.0 as distance_km
    from public.families f
    where f.id <> requester_family.id
      and f.visibility = 'discoverable'
      and f.location is not null
      and (p_country_code is null or f.country_of_residence = upper(p_country_code))
      and extensions.st_dwithin(requester_family.location, f.location, least(effective_radius, f.discovery_radius_km) * 1000.0)
      and exists (
        select 1 from public.family_members active_member
        join public.profiles active_profile on active_profile.id = active_member.profile_id
        where active_member.family_id = f.id and active_member.status = 'active' and active_profile.status = 'active'
      )
      and not exists (
        select 1 from public.discovery_blocks block
        where (block.blocker_family_id = requester_family.id and block.blocked_family_id = f.id)
           or (block.blocker_family_id = f.id and block.blocked_family_id = requester_family.id)
      )
      and (p_culture_ids is null or exists (
        select 1 from public.family_cultures fc where fc.family_id = f.id and fc.culture_id = any(p_culture_ids)
      ))
      and (p_language_ids is null or exists (
        select 1 from public.family_languages fl where fl.family_id = f.id and fl.language_id = any(p_language_ids)
      ))
      and (p_interest_ids is null or exists (
        select 1 from public.family_interests fi where fi.family_id = f.id and fi.interest_id = any(p_interest_ids)
      ))
      and ((p_min_child_age is null and p_max_child_age is null) or exists (
        select 1 from public.children child
        where child.family_id = f.id
          and extract(year from age(current_date, make_date(child.birth_year, coalesce(child.birth_month, 7), 1)))::integer
              between coalesce(p_min_child_age, 0) and coalesce(p_max_child_age, 20)
      ))
      and (p_weekday is null or exists (
        select 1 from public.family_availability availability
        where availability.family_id = f.id
          and availability.weekday = p_weekday
          and availability.period = p_period
      ))
  ), scored as (
    select candidate.*,
      kinavela_private.calculate_family_match(
        requester_family.id,
        candidate.id,
        candidate.distance_km,
        effective_radius
      ) as match
    from candidates candidate
  ), enriched as (
    select scored.*,
      coalesce((select array_agg(distinct culture.name order by culture.name)
        from public.family_cultures fc join public.cultures culture on culture.id = fc.culture_id
        where fc.family_id = scored.id), '{}'::text[]) as culture_names,
      coalesce((select array_agg(distinct language.name order by language.name)
        from public.family_languages fl join public.languages language on language.id = fl.language_id
        where fl.family_id = scored.id), '{}'::text[]) as language_names,
      coalesce((select array_agg(distinct interest.slug order by interest.slug)
        from public.family_interests fi join public.interests interest on interest.id = fi.interest_id
        where fi.family_id = scored.id and exists (
          select 1 from public.family_interests own_interest
          where own_interest.family_id = requester_family.id and own_interest.interest_id = fi.interest_id
        )), '{}'::text[]) as shared_interest_names,
      coalesce((select array_agg(distinct case
          when child_age <= 2 then '0-2'
          when child_age <= 5 then '3-5'
          when child_age <= 8 then '6-8'
          when child_age <= 12 then '9-12'
          when child_age <= 15 then '13-15'
          when child_age <= 18 then '16-18'
          else '18+'
        end)
        from (
          select extract(year from age(current_date, make_date(child.birth_year, coalesce(child.birth_month, 7), 1)))::integer child_age
          from public.children child where child.family_id = scored.id
        ) ages), '{}'::text[]) as age_ranges
    from scored
  )
  select enriched.id,
    enriched.name,
    enriched.city || ' area',
    case
      when enriched.distance_km < 5 then '<5 km'
      when enriched.distance_km < 10 then '5-10 km'
      when enriched.distance_km < 20 then '10-20 km'
      when enriched.distance_km < 30 then '20-30 km'
      when enriched.distance_km < 50 then '30-50 km'
      else '50-100 km'
    end,
    (enriched.match ->> 'score')::smallint,
    enriched.age_ranges,
    enriched.culture_names,
    enriched.language_names,
    enriched.shared_interest_names,
    array_remove(array[
      case when (enriched.match #>> '{components,child_age}')::integer >= 60 then 'children_similar_age' end,
      case when (enriched.match #>> '{components,culture}')::integer > 0 then 'shared_culture' end,
      case when (enriched.match #>> '{components,language}')::integer > 0 then 'shared_language' end,
      case when (enriched.match #>> '{components,interests}')::integer > 0 then 'shared_interests' end,
      case when (enriched.match #>> '{components,availability}')::integer > 0 then 'availability_overlap' end,
      case when (enriched.match #>> '{components,preferences}')::integer = 100 then 'shared_origin_country' end,
      case when (enriched.match #>> '{components,distance}')::integer >= 50 then 'nearby' end
    ], null)::text[]
  from enriched
  order by (enriched.match ->> 'score')::integer desc, enriched.distance_km, enriched.id
  limit p_limit offset p_offset;
end;
$$;

revoke all on function public.match_families(integer, text, uuid[], uuid[], uuid[], integer, integer, integer, text, integer, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.match_families(integer, text, uuid[], uuid[], uuid[], integer, integer, integer, text, integer, integer)
  to authenticated;

insert into kinavela_private.schema_migrations(version)
values ('202608090006_deterministic_matching')
on conflict (version) do nothing;

notify pgrst, 'reload schema';
commit;
