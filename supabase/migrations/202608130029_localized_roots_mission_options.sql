begin;

create function public.get_roots_passport_options_v2(p_child_id uuid, p_locale text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  passport_uuid uuid;
  family_uuid uuid;
  result jsonb;
begin
  if p_locale not in ('de', 'fr', 'en') then raise exception 'invalid_locale'; end if;
  if public.current_profile_id() is null then raise exception 'not_authenticated'; end if;
  select passport.id, child.family_id into passport_uuid, family_uuid
  from public.roots_passports passport
  join public.children child on child.id = passport.child_id
  where child.id = p_child_id;
  if passport_uuid is null or not kinavela_private.can_manage_roots_passport(passport_uuid) then
    raise exception 'not_authorized';
  end if;

  select jsonb_build_object(
    'cultures', coalesce((
      select jsonb_agg(jsonb_build_object('id', culture.id, 'name', translation.display_name)
        order by translation.display_name, culture.id)
      from public.cultures culture
      join public.culture_translations translation
        on translation.culture_id = culture.id
        and translation.locale = p_locale and translation.review_status = 'reviewed'
    ), '[]'::jsonb),
    'languages', coalesce((
      select jsonb_agg(jsonb_build_object('id', language.id, 'name', translation.display_name)
        order by translation.display_name, language.id)
      from public.languages language
      join public.language_translations translation
        on translation.language_id = language.id
        and translation.locale = p_locale and translation.review_status = 'reviewed'
    ), '[]'::jsonb),
    'missions', coalesce((
      select jsonb_agg(jsonb_build_object('id', mission.id, 'name', translation.title)
        order by translation.title, mission.id)
      from public.cultural_missions mission
      join public.cultural_mission_translations translation
        on translation.mission_id = mission.id
        and translation.locale = p_locale
        and translation.content_version = mission.content_version
        and translation.review_status = 'reviewed'
      where exists (
        select 1 from public.family_mission_progress progress
        where progress.family_id = family_uuid and progress.mission_id = mission.id
          and progress.status = 'completed'
      )
    ), '[]'::jsonb),
    'villages', coalesce((
      select jsonb_agg(jsonb_build_object('id', village.id, 'name', village.name)
        order by village.name, village.id)
      from public.villages village
      where exists (
        select 1 from public.village_members member
        where member.village_id = village.id and member.family_id = family_uuid
          and member.status = 'active'
      ) and village.status = 'active'
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', event.id, 'name', event.title, 'village_id', event.village_id)
        order by event.starts_at desc, event.id)
      from public.events event
      where exists (
        select 1 from public.village_members member
        where member.village_id = event.village_id and member.family_id = family_uuid
          and member.status = 'active'
      )
    ), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

revoke all on function public.get_roots_passport_options_v2(uuid, text)
  from public, anon, service_role;
grant execute on function public.get_roots_passport_options_v2(uuid, text)
  to authenticated;

insert into kinavela_private.schema_migrations(version)
values ('202608130029_localized_roots_mission_options')
on conflict (version) do nothing;

notify pgrst, 'reload schema';

commit;
