\set ON_ERROR_STOP on
begin;

do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public'
      and table_name = 'cultural_mission_translations'
  ) then
    raise exception 'Localized cultural mission translations table is missing';
  end if;

  if (
    select count(*)
    from public.cultural_missions mission
    where mission.active and mission.review_status = 'reviewed'
  ) <> (
    select count(*)
    from public.cultural_mission_translations translation
    join public.cultural_missions mission on mission.id = translation.mission_id
    where mission.active
      and mission.review_status = 'reviewed'
      and translation.locale = 'en'
      and translation.content_version = mission.content_version
      and translation.review_status = 'reviewed'
  ) then
    raise exception 'Every published mission needs a reviewed English translation baseline';
  end if;

  if exists (
    select 1
    from public.cultural_mission_translations
    where review_status = 'reviewed' and reviewed_at is null
  ) or exists (
    select 1
    from public.mission_step_translations
    where review_status = 'reviewed' and reviewed_at is null
  ) then
    raise exception 'Reviewed localized cultural content requires review evidence';
  end if;

  if has_table_privilege('anon', 'public.cultural_mission_translations', 'select')
    or has_table_privilege('anon', 'public.mission_step_translations', 'select')
    or not has_table_privilege('authenticated', 'public.cultural_mission_translations', 'select')
  then
    raise exception 'Localized cultural content grants are incorrect';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'cultural_mission_translations'
      and policyname = 'Authenticated families read reviewed mission translations'
  ) then
    raise exception 'Mission translation reviewed-content RLS policy is missing';
  end if;
end
$$;

rollback;
