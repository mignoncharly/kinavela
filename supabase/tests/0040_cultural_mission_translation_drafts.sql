\set ON_ERROR_STOP on
begin;

do $$
begin
  if exists (
    select 1
    from public.cultural_missions mission
    cross join (values ('de'), ('fr')) as locale(locale)
    left join public.cultural_mission_translations translation
      on translation.mission_id = mission.id
      and translation.locale = locale.locale
      and translation.content_version = mission.content_version
    where mission.active
      and mission.review_status = 'reviewed'
      and (
        translation.mission_id is null
        or translation.review_status not in ('needs_review', 'reviewed')
        or (translation.review_status = 'needs_review' and (
          translation.reviewed_at is not null or translation.reviewed_by is not null
        ))
        or (translation.review_status = 'reviewed' and translation.reviewed_at is null)
      )
  ) then
    raise exception 'Every published mission needs a valid German and French translation record';
  end if;

  if exists (
    select 1
    from public.mission_steps step
    join public.cultural_missions mission on mission.id = step.mission_id
    cross join (values ('de'), ('fr')) as locale(locale)
    left join public.mission_step_translations translation
      on translation.step_id = step.id
      and translation.locale = locale.locale
      and translation.content_version = mission.content_version
    where mission.active
      and mission.review_status = 'reviewed'
      and (
        translation.step_id is null
        or translation.review_status not in ('needs_review', 'reviewed')
        or (translation.review_status = 'needs_review' and (
          translation.reviewed_at is not null or translation.reviewed_by is not null
        ))
        or (translation.review_status = 'reviewed' and translation.reviewed_at is null)
      )
  ) then
    raise exception 'Every published mission step needs a valid German and French translation record';
  end if;
end
$$;

rollback;
