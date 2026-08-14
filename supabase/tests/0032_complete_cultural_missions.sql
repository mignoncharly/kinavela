\set ON_ERROR_STOP on
begin;

do $$
declare
  required_categories text[] := array[
    'games', 'storytelling', 'history', 'geography', 'music',
    'traditions', 'family', 'language', 'cooking'
  ];
begin
  if (
    select count(*) from public.cultural_missions
    where active and review_status = 'reviewed' and content_version >= 2
  ) < 10 then
    raise exception 'Phase 9 requires at least ten reviewed cultural missions';
  end if;

  if exists (
    select 1 from unnest(required_categories) required(category)
    where not exists (
      select 1 from public.cultural_missions mission
      where mission.active and mission.review_status = 'reviewed'
        and mission.category = required.category
    )
  ) then
    raise exception 'The reviewed catalogue does not cover every Phase 9 activity area';
  end if;

  if (
    select count(distinct culture.name)
    from public.cultural_missions mission
    join public.cultures culture on culture.id = mission.culture_id
    where mission.active and mission.review_status = 'reviewed'
      and culture.name in ('Bamiléké', 'Bassa', 'Beti', 'Duala')
  ) <> 4 then
    raise exception 'Community-specific Bamiléké, Bassa, Beti and Duala contexts are required';
  end if;

  if exists (
    select 1 from public.cultural_missions mission
    where mission.active and (
      mission.review_status <> 'reviewed'
      or mission.reviewed_at is null
      or cardinality(mission.materials) = 0
      or char_length(btrim(mission.cultural_context)) < 20
      or char_length(btrim(mission.guardian_guidance)) < 20
      or char_length(btrim(mission.respectful_attribution)) < 20
      or char_length(btrim(mission.passport_reflection_prompt)) < 10
      or not exists (
        select 1 from public.mission_steps step
        where step.mission_id = mission.id
      )
    )
  ) then
    raise exception 'An active mission is missing reviewed educational content';
  end if;

  if has_function_privilege('anon', 'public.list_cultural_missions_v3(text)', 'execute')
    or has_function_privilege('anon', 'public.list_village_missions_v3(uuid, text)', 'execute')
    or not has_function_privilege('authenticated', 'public.list_cultural_missions_v3(text)', 'execute')
  then
    raise exception 'Phase 9 localized mission catalogue grants are incorrect';
  end if;

  if pg_get_function_result('public.list_cultural_missions_v3(text)'::regprocedure)
      ~* '(child_id|child_name|email|location|coordinate|longitude|latitude)'
  then
    raise exception 'Mission content projection exposes private family or child data';
  end if;
end
$$;

rollback;
