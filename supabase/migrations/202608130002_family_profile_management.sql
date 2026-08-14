begin;

create or replace function public.update_my_family_settings(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_uuid uuid := public.current_profile_id();
  family_uuid uuid;
  child_item jsonb;
  culture_item jsonb;
  language_item jsonb;
  availability_item jsonb;
  child_uuid uuid;
  minimum_age integer;
  maximum_age integer;
  removed_child record;
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;

  select member.family_id into family_uuid
  from public.family_members member
  where member.profile_id = profile_uuid
    and member.role = 'owner'
    and member.status = 'active'
  order by member.created_at
  limit 1;
  if family_uuid is null then raise exception 'owner_required'; end if;

  if jsonb_typeof(coalesce(p_payload, 'null'::jsonb)) <> 'object'
     or jsonb_typeof(p_payload -> 'children') <> 'array'
     or jsonb_typeof(p_payload -> 'cultures') <> 'array'
     or jsonb_typeof(p_payload -> 'languages') <> 'array'
     or jsonb_typeof(p_payload -> 'interest_ids') <> 'array'
     or jsonb_typeof(p_payload -> 'availability') <> 'array'
     or jsonb_typeof(p_payload -> 'preferences') <> 'object' then
    raise exception 'invalid_family_settings';
  end if;

  if char_length(btrim(coalesce(p_payload #>> '{family,name}', ''))) not between 2 and 100
     or char_length(coalesce(p_payload #>> '{family,bio}', '')) > 600
     or p_payload #>> '{family,visibility}' not in ('private', 'discoverable') then
    raise exception 'invalid_family_profile';
  end if;

  if coalesce(jsonb_array_length(p_payload -> 'children'), 0) not between 1 and 8 then
    raise exception 'invalid_children';
  end if;
  if coalesce(jsonb_array_length(p_payload -> 'cultures'), 0) not between 1 and 8 then
    raise exception 'invalid_cultures';
  end if;
  if coalesce(jsonb_array_length(p_payload -> 'languages'), 0) not between 1 and 10 then
    raise exception 'invalid_languages';
  end if;
  if coalesce(jsonb_array_length(p_payload -> 'interest_ids'), 0) not between 1 and 16 then
    raise exception 'invalid_interests';
  end if;
  if coalesce(jsonb_array_length(p_payload -> 'availability'), 0) not between 1 and 21 then
    raise exception 'invalid_availability';
  end if;

  if exists (
    select 1
    from jsonb_array_elements_text(p_payload -> 'preservation_goals') goal(value)
    where goal.value not in (
      'language', 'stories', 'recipes', 'traditions', 'history', 'music',
      'family_connections'
    )
  ) or jsonb_array_length(p_payload -> 'preservation_goals') < 1 then
    raise exception 'invalid_preservation_goals';
  end if;

  minimum_age := (p_payload #>> '{preferences,min_child_age}')::integer;
  maximum_age := (p_payload #>> '{preferences,max_child_age}')::integer;
  if minimum_age not between 0 and 20
     or maximum_age not between 0 and 20
     or minimum_age > maximum_age then
    raise exception 'invalid_age_range';
  end if;

  if exists (
    select 1
    from (values
      ((p_payload #>> '{preferences,same_country_priority}')::integer),
      ((p_payload #>> '{preferences,same_culture_priority}')::integer),
      ((p_payload #>> '{preferences,similar_child_age_priority}')::integer),
      ((p_payload #>> '{preferences,same_language_priority}')::integer),
      ((p_payload #>> '{preferences,shared_interests_priority}')::integer),
      ((p_payload #>> '{preferences,availability_priority}')::integer)
    ) priority(value)
    where priority.value not between 0 and 5
  ) then
    raise exception 'invalid_matching_priorities';
  end if;

  if (select count(*) from jsonb_array_elements(p_payload -> 'cultures')) <>
     (select count(distinct item ->> 'culture_id') from jsonb_array_elements(p_payload -> 'cultures') item)
     or (select count(*) from jsonb_array_elements(p_payload -> 'languages')) <>
        (select count(distinct item ->> 'language_id') from jsonb_array_elements(p_payload -> 'languages') item)
     or (select count(*) from jsonb_array_elements_text(p_payload -> 'interest_ids')) <>
        (select count(distinct value) from jsonb_array_elements_text(p_payload -> 'interest_ids'))
     or (select count(*) from jsonb_array_elements(p_payload -> 'availability')) <>
        (select count(distinct (item ->> 'weekday', item ->> 'period')) from jsonb_array_elements(p_payload -> 'availability') item)
     or (select count(*) from jsonb_array_elements(p_payload -> 'children') item where item ->> 'id' is not null) <>
        (select count(distinct item ->> 'id') from jsonb_array_elements(p_payload -> 'children') item where item ->> 'id' is not null) then
    raise exception 'duplicate_family_settings';
  end if;

  for child_item in select value from jsonb_array_elements(p_payload -> 'children') loop
    if char_length(btrim(coalesce(child_item ->> 'nickname', ''))) not between 1 and 40
       or (child_item ->> 'birth_year')::integer not between 2005 and extract(year from current_date)::integer
       or (child_item ->> 'birth_month') is not null
          and (child_item ->> 'birth_month')::integer not between 1 and 12
       or coalesce(child_item ->> 'gender', '') not in (
          '', 'female', 'male', 'nonbinary', 'prefer_not_to_say'
       )
       or child_item ->> 'visibility' not in ('guardians', 'connections') then
      raise exception 'invalid_child';
    end if;

    if child_item ->> 'id' is not null then
      child_uuid := (child_item ->> 'id')::uuid;
      if not exists (
        select 1 from public.children child
        where child.id = child_uuid and child.family_id = family_uuid
      ) then
        raise exception 'child_not_found';
      end if;
    end if;
  end loop;

  for removed_child in
    select child.id
    from public.children child
    where child.family_id = family_uuid
      and not exists (
        select 1
        from jsonb_array_elements(p_payload -> 'children') item
        where item ->> 'id' = child.id::text
      )
  loop
    if exists (
      select 1
      from public.roots_passports passport
      where passport.child_id = removed_child.id
        and (
          exists (select 1 from public.roots_passport_entries entry where entry.passport_id = passport.id)
          or exists (select 1 from public.roots_passport_exports export where export.passport_id = passport.id)
        )
    ) or exists (
      select 1 from public.story_requests request where request.child_id = removed_child.id
    ) or exists (
      select 1 from public.family_stories story where story.child_id = removed_child.id
    ) then
      raise exception 'child_has_cultural_history';
    end if;
  end loop;

  update public.families
  set name = btrim(p_payload #>> '{family,name}'),
      bio = nullif(btrim(coalesce(p_payload #>> '{family,bio}', '')), ''),
      visibility = p_payload #>> '{family,visibility}',
      preservation_goals = array(
        select distinct value
        from jsonb_array_elements_text(p_payload -> 'preservation_goals')
        order by value
      ),
      updated_at = now()
  where id = family_uuid;

  delete from public.children child
  where child.family_id = family_uuid
    and not exists (
      select 1
      from jsonb_array_elements(p_payload -> 'children') item
      where item ->> 'id' = child.id::text
    );

  for child_item in select value from jsonb_array_elements(p_payload -> 'children') loop
    child_uuid := nullif(child_item ->> 'id', '')::uuid;
    if child_uuid is null then
      insert into public.children(
        family_id, nickname, birth_year, birth_month, gender, visibility
      ) values (
        family_uuid,
        btrim(child_item ->> 'nickname'),
        (child_item ->> 'birth_year')::smallint,
        (child_item ->> 'birth_month')::smallint,
        nullif(child_item ->> 'gender', ''),
        child_item ->> 'visibility'
      );
    else
      update public.children
      set nickname = btrim(child_item ->> 'nickname'),
          birth_year = (child_item ->> 'birth_year')::smallint,
          birth_month = (child_item ->> 'birth_month')::smallint,
          gender = nullif(child_item ->> 'gender', ''),
          visibility = child_item ->> 'visibility',
          updated_at = now()
      where id = child_uuid and family_id = family_uuid;
    end if;
  end loop;

  delete from public.family_cultures where family_id = family_uuid;
  for culture_item in select value from jsonb_array_elements(p_payload -> 'cultures') loop
    if culture_item ->> 'relationship_type' not in ('origin', 'heritage', 'connection', 'interest')
       or (culture_item ->> 'priority')::integer not between 1 and 5 then
      raise exception 'invalid_culture';
    end if;
    insert into public.family_cultures(family_id, culture_id, relationship_type, priority)
    values (
      family_uuid,
      (culture_item ->> 'culture_id')::uuid,
      culture_item ->> 'relationship_type',
      (culture_item ->> 'priority')::smallint
    );
  end loop;

  delete from public.family_languages where family_id = family_uuid;
  for language_item in select value from jsonb_array_elements(p_payload -> 'languages') loop
    if language_item ->> 'proficiency' not in ('beginner', 'conversational', 'fluent', 'native')
       or language_item ->> 'transmission_goal' not in (
         'already_speaking', 'learning', 'want_to_teach_children', 'cultural_interest'
       ) then
      raise exception 'invalid_language';
    end if;
    insert into public.family_languages(family_id, language_id, proficiency, transmission_goal)
    values (
      family_uuid,
      (language_item ->> 'language_id')::uuid,
      language_item ->> 'proficiency',
      language_item ->> 'transmission_goal'
    );
  end loop;

  delete from public.family_interests where family_id = family_uuid;
  insert into public.family_interests(family_id, interest_id)
  select family_uuid, value::uuid
  from jsonb_array_elements_text(p_payload -> 'interest_ids');

  delete from public.family_availability where family_id = family_uuid;
  for availability_item in select value from jsonb_array_elements(p_payload -> 'availability') loop
    if (availability_item ->> 'weekday')::integer not between 0 and 6
       or availability_item ->> 'period' not in ('morning', 'afternoon', 'evening') then
      raise exception 'invalid_availability';
    end if;
    insert into public.family_availability(family_id, weekday, period)
    values (
      family_uuid,
      (availability_item ->> 'weekday')::smallint,
      availability_item ->> 'period'
    );
  end loop;

  update public.discovery_preferences
  set same_country_priority = (p_payload #>> '{preferences,same_country_priority}')::smallint,
      same_culture_priority = (p_payload #>> '{preferences,same_culture_priority}')::smallint,
      similar_child_age_priority = (p_payload #>> '{preferences,similar_child_age_priority}')::smallint,
      same_language_priority = (p_payload #>> '{preferences,same_language_priority}')::smallint,
      shared_interests_priority = (p_payload #>> '{preferences,shared_interests_priority}')::smallint,
      availability_priority = (p_payload #>> '{preferences,availability_priority}')::smallint,
      open_to_other_african_families = (p_payload #>> '{preferences,open_to_other_african_families}')::boolean,
      open_to_all_diaspora_families = (p_payload #>> '{preferences,open_to_all_diaspora_families}')::boolean,
      min_child_age = minimum_age,
      max_child_age = maximum_age,
      updated_at = now()
  where family_id = family_uuid;

  insert into public.audit_events(
    actor_profile_id, event_type, entity_type, entity_id,
    metadata
  ) values (
    profile_uuid, 'family_settings_updated', 'family', family_uuid,
    jsonb_build_object(
      'children', jsonb_array_length(p_payload -> 'children'),
      'cultures', jsonb_array_length(p_payload -> 'cultures'),
      'languages', jsonb_array_length(p_payload -> 'languages'),
      'interests', jsonb_array_length(p_payload -> 'interest_ids'),
      'availability_slots', jsonb_array_length(p_payload -> 'availability')
    )
  );

  return family_uuid;
exception
  when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'invalid_family_settings';
end;
$$;

-- All family-profile writes now pass through reviewed RPCs. Membership
-- management retains its existing authorization path.
revoke update on public.families from authenticated;
revoke update(country_of_residence, city) on public.profiles from authenticated;
revoke insert, update, delete on public.children,
  public.family_cultures,
  public.family_languages,
  public.family_interests,
  public.family_availability,
  public.discovery_preferences
from authenticated;

revoke all on function public.update_my_family_settings(jsonb)
from public, anon, authenticated, service_role;
grant execute on function public.update_my_family_settings(jsonb)
to authenticated;

insert into kinavela_private.schema_migrations(version)
values ('202608130002_family_profile_management')
on conflict (version) do nothing;

notify pgrst, 'reload schema';
commit;
