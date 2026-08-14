begin;

-- Approval was confirmed by the product owner on 2026-08-13. The reviewer is
-- external to the application, so no profile ID is fabricated here.
update public.cultural_mission_translations translation
set review_status = 'reviewed', reviewed_at = '2026-08-13 00:00:00+00',
  reviewed_by = null, updated_at = now()
from public.cultural_missions mission
where mission.id = translation.mission_id
  and mission.slug = any (array[
    'five-greetings-from-cameroon', 'family-recipe-table',
    'map-a-family-journey', 'family-song-and-rhythm', 'teach-a-family-game',
    'bassa-family-folktale', 'cameroon-history-family-timeline',
    'bamileke-family-celebration', 'beti-words-and-family-values',
    'grandparent-heritage-interview'
  ])
  and translation.locale in ('de', 'fr')
  and translation.content_version = mission.content_version
  and translation.review_status = 'needs_review';

update public.mission_step_translations translation
set review_status = 'reviewed', reviewed_at = '2026-08-13 00:00:00+00',
  reviewed_by = null, updated_at = now()
from public.mission_steps step
join public.cultural_missions mission on mission.id = step.mission_id
where step.id = translation.step_id
  and mission.slug = any (array[
    'five-greetings-from-cameroon', 'family-recipe-table',
    'map-a-family-journey', 'family-song-and-rhythm', 'teach-a-family-game',
    'bassa-family-folktale', 'cameroon-history-family-timeline',
    'bamileke-family-celebration', 'beti-words-and-family-values',
    'grandparent-heritage-interview'
  ])
  and translation.locale in ('de', 'fr')
  and translation.content_version = mission.content_version
  and translation.review_status = 'needs_review';

do $$
begin
  if (
    select count(*)
    from public.cultural_mission_translations translation
    join public.cultural_missions mission on mission.id = translation.mission_id
    where mission.slug = any (array[
      'five-greetings-from-cameroon', 'family-recipe-table',
      'map-a-family-journey', 'family-song-and-rhythm', 'teach-a-family-game',
      'bassa-family-folktale', 'cameroon-history-family-timeline',
      'bamileke-family-celebration', 'beti-words-and-family-values',
      'grandparent-heritage-interview'
    ])
      and translation.locale in ('de', 'fr')
      and translation.content_version = mission.content_version
      and translation.review_status = 'reviewed'
      and translation.reviewed_at is not null
  ) <> 20 then
    raise exception 'The approved catalogue must contain 20 reviewed German/French mission translations';
  end if;

  if (
    select count(*)
    from public.mission_step_translations translation
    join public.mission_steps step on step.id = translation.step_id
    join public.cultural_missions mission on mission.id = step.mission_id
    where mission.slug = any (array[
      'five-greetings-from-cameroon', 'family-recipe-table',
      'map-a-family-journey', 'family-song-and-rhythm', 'teach-a-family-game',
      'bassa-family-folktale', 'cameroon-history-family-timeline',
      'bamileke-family-celebration', 'beti-words-and-family-values',
      'grandparent-heritage-interview'
    ])
      and translation.locale in ('de', 'fr')
      and translation.content_version = mission.content_version
      and translation.review_status = 'reviewed'
      and translation.reviewed_at is not null
  ) <> 80 then
    raise exception 'The approved catalogue must contain 80 reviewed German/French mission step translations';
  end if;
end
$$;

create function public.list_cultural_missions_v3(p_locale text)
returns table (
  mission_id uuid, slug text, title text, summary text, description text,
  category text, culture_id uuid, culture_name text, country_name text,
  min_age smallint, max_age smallint, estimated_minutes smallint,
  cultural_context text, materials text[], guardian_guidance text,
  respectful_attribution text, passport_reflection_prompt text,
  context_scope text, content_version smallint, content_locale text, steps jsonb,
  progress_id uuid, progress_status text, completed_step_ids uuid[],
  completed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  family_uuid uuid := kinavela_private.current_family_id(false);
begin
  if p_locale not in ('de', 'fr', 'en') then raise exception 'invalid_locale'; end if;
  if public.current_profile_id() is null then raise exception 'not_authenticated'; end if;
  if family_uuid is null then raise exception 'family_not_found'; end if;

  return query
  select mission.id, mission.slug, translation.title, translation.summary,
    translation.description, mission.category, mission.culture_id,
    culture_translation.display_name, country_translation.display_name,
    mission.min_age, mission.max_age, mission.estimated_minutes,
    translation.cultural_context, translation.materials,
    translation.guardian_guidance, translation.respectful_attribution,
    translation.passport_reflection_prompt, mission.context_scope,
    mission.content_version, p_locale,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'step_id', step.id, 'position', step.position,
        'title', step_translation.title, 'description', step_translation.description
      ) order by step.position)
      from public.mission_steps step
      join public.mission_step_translations step_translation
        on step_translation.step_id = step.id
        and step_translation.locale = p_locale
        and step_translation.content_version = mission.content_version
        and step_translation.review_status = 'reviewed'
      where step.mission_id = mission.id
    ), '[]'::jsonb),
    progress.id, progress.status,
    coalesce(progress.completed_step_ids, '{}'::uuid[]), progress.completed_at
  from public.cultural_missions mission
  join public.cultural_mission_translations translation
    on translation.mission_id = mission.id
    and translation.locale = p_locale
    and translation.content_version = mission.content_version
    and translation.review_status = 'reviewed'
  left join public.cultures culture on culture.id = mission.culture_id
  left join public.culture_translations culture_translation
    on culture_translation.culture_id = culture.id
    and culture_translation.locale = p_locale
    and culture_translation.review_status = 'reviewed'
  left join public.countries country on country.id = culture.country_id
  left join public.country_translations country_translation
    on country_translation.country_id = country.id
    and country_translation.locale = p_locale
    and country_translation.review_status = 'reviewed'
  left join public.family_mission_progress progress
    on progress.mission_id = mission.id
    and progress.family_id = family_uuid
    and progress.village_mission_id is null
  where mission.active and mission.review_status = 'reviewed'
    and not exists (
      select 1
      from public.mission_steps step
      left join public.mission_step_translations step_translation
        on step_translation.step_id = step.id
        and step_translation.locale = p_locale
        and step_translation.content_version = mission.content_version
        and step_translation.review_status = 'reviewed'
      where step.mission_id = mission.id and step_translation.step_id is null
    )
  order by mission.category, translation.title, mission.id;
end;
$$;

create function public.list_village_missions_v3(p_village_id uuid, p_locale text)
returns table (
  village_mission_id uuid, mission_id uuid, slug text, title text,
  summary text, description text, category text, culture_id uuid,
  culture_name text, country_name text, min_age smallint, max_age smallint,
  estimated_minutes smallint, cultural_context text, materials text[],
  guardian_guidance text, respectful_attribution text,
  passport_reflection_prompt text, context_scope text,
  content_version smallint, content_locale text, steps jsonb, progress_id uuid,
  progress_status text, completed_step_ids uuid[], completed_at timestamptz,
  assigned_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  family_uuid uuid := kinavela_private.current_family_id(false);
begin
  if p_locale not in ('de', 'fr', 'en') then raise exception 'invalid_locale'; end if;
  if public.current_profile_id() is null then raise exception 'not_authenticated'; end if;
  if family_uuid is null or not kinavela_private.can_access_village(p_village_id, false) then
    raise exception 'not_authorized';
  end if;

  return query
  select assignment.id, mission.id, mission.slug, translation.title,
    translation.summary, translation.description, mission.category, mission.culture_id,
    culture_translation.display_name, country_translation.display_name,
    mission.min_age, mission.max_age, mission.estimated_minutes,
    translation.cultural_context, translation.materials,
    translation.guardian_guidance, translation.respectful_attribution,
    translation.passport_reflection_prompt, mission.context_scope,
    mission.content_version, p_locale,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'step_id', step.id, 'position', step.position,
        'title', step_translation.title, 'description', step_translation.description
      ) order by step.position)
      from public.mission_steps step
      join public.mission_step_translations step_translation
        on step_translation.step_id = step.id
        and step_translation.locale = p_locale
        and step_translation.content_version = mission.content_version
        and step_translation.review_status = 'reviewed'
      where step.mission_id = mission.id
    ), '[]'::jsonb),
    progress.id, progress.status,
    coalesce(progress.completed_step_ids, '{}'::uuid[]), progress.completed_at,
    assignment.created_at
  from public.village_missions assignment
  join public.cultural_missions mission
    on mission.id = assignment.mission_id
    and mission.active and mission.review_status = 'reviewed'
  join public.cultural_mission_translations translation
    on translation.mission_id = mission.id
    and translation.locale = p_locale
    and translation.content_version = mission.content_version
    and translation.review_status = 'reviewed'
  left join public.cultures culture on culture.id = mission.culture_id
  left join public.culture_translations culture_translation
    on culture_translation.culture_id = culture.id
    and culture_translation.locale = p_locale
    and culture_translation.review_status = 'reviewed'
  left join public.countries country on country.id = culture.country_id
  left join public.country_translations country_translation
    on country_translation.country_id = country.id
    and country_translation.locale = p_locale
    and country_translation.review_status = 'reviewed'
  left join public.family_mission_progress progress
    on progress.village_mission_id = assignment.id
    and progress.family_id = family_uuid
  where assignment.village_id = p_village_id and assignment.status = 'active'
    and not exists (
      select 1
      from public.mission_steps step
      left join public.mission_step_translations step_translation
        on step_translation.step_id = step.id
        and step_translation.locale = p_locale
        and step_translation.content_version = mission.content_version
        and step_translation.review_status = 'reviewed'
      where step.mission_id = mission.id and step_translation.step_id is null
    )
  order by assignment.created_at desc, assignment.id;
end;
$$;

revoke all on function public.list_cultural_missions_v2(),
  public.list_village_missions_v2(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.list_cultural_missions_v3(text),
  public.list_village_missions_v3(uuid, text)
  from public, anon, service_role;
grant execute on function public.list_cultural_missions_v3(text),
  public.list_village_missions_v3(uuid, text)
  to authenticated;

insert into kinavela_private.schema_migrations(version)
values ('202608130028_publish_reviewed_cultural_mission_translations')
on conflict (version) do nothing;

notify pgrst, 'reload schema';

commit;
