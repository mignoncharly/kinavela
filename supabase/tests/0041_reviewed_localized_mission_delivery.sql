\set ON_ERROR_STOP on
begin;

do $$
begin
  if (
    select count(*)
    from public.cultural_missions mission
    cross join (values ('de'), ('fr'), ('en')) as locale(locale)
    left join public.cultural_mission_translations translation
      on translation.mission_id = mission.id
      and translation.locale = locale.locale
      and translation.content_version = mission.content_version
      and translation.review_status = 'reviewed'
    where mission.active and mission.review_status = 'reviewed'
      and translation.mission_id is null
  ) > 0 then
    raise exception 'Every published mission needs a reviewed translation in every supported locale';
  end if;

  if (
    select count(*)
    from public.mission_steps step
    join public.cultural_missions mission on mission.id = step.mission_id
    cross join (values ('de'), ('fr'), ('en')) as locale(locale)
    left join public.mission_step_translations translation
      on translation.step_id = step.id
      and translation.locale = locale.locale
      and translation.content_version = mission.content_version
      and translation.review_status = 'reviewed'
    where mission.active and mission.review_status = 'reviewed'
      and translation.step_id is null
  ) > 0 then
    raise exception 'Every published mission step needs a reviewed translation in every supported locale';
  end if;

  if has_function_privilege('anon', 'public.list_cultural_missions_v3(text)', 'execute')
    or has_function_privilege('anon', 'public.list_village_missions_v3(uuid, text)', 'execute')
    or has_function_privilege('anon', 'public.get_roots_passport_options_v2(uuid, text)', 'execute')
    or not has_function_privilege('authenticated', 'public.list_cultural_missions_v3(text)', 'execute')
    or not has_function_privilege('authenticated', 'public.list_village_missions_v3(uuid, text)', 'execute')
    or not has_function_privilege('authenticated', 'public.get_roots_passport_options_v2(uuid, text)', 'execute')
  then
    raise exception 'Localized mission delivery function grants are incorrect';
  end if;

  if pg_get_function_result('public.list_cultural_missions_v3(text)'::regprocedure)
      !~* 'content_locale'
  then
    raise exception 'Localized mission payloads must declare their content locale';
  end if;
end
$$;

rollback;
