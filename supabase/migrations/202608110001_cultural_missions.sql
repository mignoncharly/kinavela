begin;

create table public.cultural_missions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,120}$'),
  title text not null check (char_length(btrim(title)) between 3 and 160),
  summary text not null check (char_length(btrim(summary)) between 10 and 300),
  description text not null check (char_length(btrim(description)) between 10 and 2000),
  category text not null check (category in (
    'language', 'cooking', 'history', 'geography', 'music',
    'storytelling', 'traditions', 'family', 'travel', 'games'
  )),
  culture_id uuid references public.cultures(id) on delete restrict,
  min_age smallint not null default 0 check (min_age between 0 and 20),
  max_age smallint not null default 18 check (max_age between 0 and 20),
  estimated_minutes smallint not null default 30 check (estimated_minutes between 5 and 480),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (min_age <= max_age)
);

create table public.mission_steps (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.cultural_missions(id) on delete cascade,
  position smallint not null check (position between 1 and 20),
  title text not null check (char_length(btrim(title)) between 2 and 120),
  description text not null check (char_length(btrim(description)) between 10 and 1000),
  created_at timestamptz not null default now(),
  unique(mission_id, position)
);

create index cultural_missions_catalogue_idx
  on public.cultural_missions(active, category, min_age, max_age);
create index cultural_missions_culture_idx
  on public.cultural_missions(culture_id, active);
create index mission_steps_mission_position_idx
  on public.mission_steps(mission_id, position);

create table public.village_missions (
  id uuid primary key default gen_random_uuid(),
  village_id uuid not null references public.villages(id) on delete cascade,
  mission_id uuid not null references public.cultural_missions(id) on delete restrict,
  assigned_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(village_id, mission_id)
);

create index village_missions_village_status_idx
  on public.village_missions(village_id, status, created_at desc);

create table public.family_mission_progress (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  mission_id uuid not null references public.cultural_missions(id) on delete restrict,
  village_mission_id uuid references public.village_missions(id) on delete cascade,
  status text not null default 'started' check (status in ('started', 'completed')),
  completed_step_ids uuid[] not null default '{}'::uuid[],
  started_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  completed_by_profile_id uuid references public.profiles(id) on delete restrict,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  check ((status = 'completed' and completed_at is not null) or (status = 'started' and completed_at is null)),
  check ((status = 'completed' and completed_by_profile_id is not null) or status = 'started')
);

create unique index family_mission_library_progress_unique
  on public.family_mission_progress(family_id, mission_id)
  where village_mission_id is null;
create unique index family_mission_village_progress_unique
  on public.family_mission_progress(family_id, village_mission_id)
  where village_mission_id is not null;
create index family_mission_progress_family_idx
  on public.family_mission_progress(family_id, status, updated_at desc);
create index family_mission_progress_village_idx
  on public.family_mission_progress(village_mission_id, status, updated_at desc);

create trigger cultural_missions_set_updated_at
  before update on public.cultural_missions
  for each row execute function public.set_updated_at();
create trigger village_missions_set_updated_at
  before update on public.village_missions
  for each row execute function public.set_updated_at();
create trigger family_mission_progress_set_updated_at
  before update on public.family_mission_progress
  for each row execute function public.set_updated_at();

alter table public.cultural_missions enable row level security;
alter table public.cultural_missions force row level security;
alter table public.mission_steps enable row level security;
alter table public.mission_steps force row level security;
alter table public.village_missions enable row level security;
alter table public.village_missions force row level security;
alter table public.family_mission_progress enable row level security;
alter table public.family_mission_progress force row level security;

revoke all on public.cultural_missions, public.mission_steps,
  public.village_missions, public.family_mission_progress
  from public, anon, authenticated;

create policy "Authenticated families read active mission catalogue"
  on public.cultural_missions for select to authenticated
  using (active = true);
create policy "Authenticated families read active mission steps"
  on public.mission_steps for select to authenticated
  using (exists (
    select 1 from public.cultural_missions mission
    where mission.id = mission_steps.mission_id and mission.active = true
  ));
create policy "Village members read active Village missions"
  on public.village_missions for select to authenticated
  using (status = 'active' and public.can_access_village(village_id));
create policy "Families read their own mission progress"
  on public.family_mission_progress for select to authenticated
  using (public.is_family_member(family_id));

insert into public.cultural_missions(
  id, slug, title, summary, description, category, culture_id, min_age, max_age, estimated_minutes
)
values
  (
    'a1000000-0000-4000-8000-000000000001',
    'five-greetings-from-cameroon',
    'Learn five greetings from Cameroon',
    'Explore greetings as a family and practise making space for one another.',
    'Choose five greetings connected to your family roots, learn when they are used, and practise them together with care for the speakers and communities who carry them.',
    'language',
    '20000000-0000-4000-8000-000000000001', 3, 18, 30
  ),
  (
    'a1000000-0000-4000-8000-000000000002',
    'family-recipe-table',
    'Bring a family recipe to the table',
    'Cook, remember and share the story behind one meaningful dish.',
    'Choose a recipe from your family or cultural tradition, make it together, and record the memories, adaptations or questions it brings up.',
    'cooking',
    '20000000-0000-4000-8000-000000000001', 3, 18, 90
  ),
  (
    'a1000000-0000-4000-8000-000000000003',
    'map-a-family-journey',
    'Map a family journey',
    'Build a simple map of places, people and memories that shaped your family.',
    'Use a paper map or a private digital note to trace a family journey. Share only what your family is comfortable keeping inside the family or Village.',
    'geography',
    '20000000-0000-4000-8000-000000000001', 6, 18, 45
  ),
  (
    'a1000000-0000-4000-8000-000000000004',
    'family-song-and-rhythm',
    'Share a family song or rhythm',
    'Listen carefully to a song, rhythm or musical memory and pass it on.',
    'Invite a family member to share a song or rhythm that matters to them. Ask permission before recording or sharing it, and make your own family version together.',
    'music',
    '20000000-0000-4000-8000-000000000001', 3, 18, 40
  )
on conflict (id) do update set
  title = excluded.title,
  summary = excluded.summary,
  description = excluded.description,
  category = excluded.category,
  culture_id = excluded.culture_id,
  min_age = excluded.min_age,
  max_age = excluded.max_age,
  estimated_minutes = excluded.estimated_minutes,
  active = true,
  updated_at = now();

insert into public.mission_steps(id, mission_id, position, title, description)
values
  ('a1100000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 1, 'Discover', 'Choose five greetings and ask a trusted speaker about their meaning and context.'),
  ('a1100000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 2, 'Listen', 'Listen to each greeting slowly and notice its sound, tone and setting.'),
  ('a1100000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001', 3, 'Practise at home', 'Practise together and let everyone choose a comfortable way to participate.'),
  ('a1100000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000001', 4, 'Use it in community', 'Use one greeting with a trusted family member or at a Village activity.'),
  ('a1200000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002', 1, 'Choose a recipe', 'Choose a recipe and learn who usually makes it and when it is served.'),
  ('a1200000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000002', 2, 'Cook together', 'Prepare the dish together, adapting tasks so every child can participate safely.'),
  ('a1200000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000002', 3, 'Ask about the memory', 'Ask a family member what memory, place or celebration they connect with the dish.'),
  ('a1200000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000002', 4, 'Share the table', 'Share the dish with your family or Village and name one thing you learned.'),
  ('a1300000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000003', 1, 'Gather places', 'Choose a few places connected to your family story without recording private addresses.'),
  ('a1300000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000003', 2, 'Draw the journey', 'Draw or assemble a simple map showing how the places connect.'),
  ('a1300000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000003', 3, 'Add a memory', 'Add one family-approved memory, phrase or question to each chosen place.'),
  ('a1300000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000003', 4, 'Tell the story', 'Tell the journey to someone you trust and invite their perspective.'),
  ('a1400000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000004', 1, 'Choose a sound', 'Choose a family song, rhythm or musical memory and ask permission to share it.'),
  ('a1400000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000004', 2, 'Listen together', 'Listen closely and notice what feelings, places or people it brings to mind.'),
  ('a1400000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000004', 3, 'Make your version', 'Create a simple family version with voice, rhythm or movement.'),
  ('a1400000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000004', 4, 'Reflect', 'Name what you want to remember and how you want to keep it private.' )
on conflict (id) do update set
  position = excluded.position,
  title = excluded.title,
  description = excluded.description;

create or replace function kinavela_private.can_manage_mission_family(p_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.family_members member
    where member.family_id = p_family_id
      and member.profile_id = public.current_profile_id()
      and member.status = 'active'
      and member.role in ('owner', 'guardian')
  );
$$;

revoke all on function kinavela_private.can_manage_mission_family(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.list_cultural_missions()
returns table (
  mission_id uuid,
  slug text,
  title text,
  summary text,
  description text,
  category text,
  culture_id uuid,
  culture_name text,
  country_name text,
  min_age smallint,
  max_age smallint,
  estimated_minutes smallint,
  steps jsonb,
  progress_id uuid,
  progress_status text,
  completed_step_ids uuid[],
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
  if public.current_profile_id() is null then raise exception 'not_authenticated'; end if;
  if family_uuid is null then raise exception 'family_not_found'; end if;

  return query
  select mission.id, mission.slug, mission.title, mission.summary, mission.description,
    mission.category, mission.culture_id, culture.name, country.name,
    mission.min_age, mission.max_age, mission.estimated_minutes,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'step_id', step.id,
        'position', step.position,
        'title', step.title,
        'description', step.description
      ) order by step.position)
      from public.mission_steps step
      where step.mission_id = mission.id
    ), '[]'::jsonb),
    progress.id, progress.status, coalesce(progress.completed_step_ids, '{}'::uuid[]), progress.completed_at
  from public.cultural_missions mission
  left join public.cultures culture on culture.id = mission.culture_id
  left join public.countries country on country.id = culture.country_id
  left join public.family_mission_progress progress
    on progress.mission_id = mission.id
   and progress.family_id = family_uuid
   and progress.village_mission_id is null
  where mission.active = true
  order by mission.category, mission.title, mission.id;
end;
$$;

create or replace function public.list_village_missions(p_village_id uuid)
returns table (
  village_mission_id uuid,
  mission_id uuid,
  slug text,
  title text,
  summary text,
  description text,
  category text,
  culture_name text,
  country_name text,
  min_age smallint,
  max_age smallint,
  estimated_minutes smallint,
  steps jsonb,
  progress_id uuid,
  progress_status text,
  completed_step_ids uuid[],
  completed_at timestamptz,
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
  if public.current_profile_id() is null then raise exception 'not_authenticated'; end if;
  if family_uuid is null or not kinavela_private.can_access_village(p_village_id, false) then
    raise exception 'not_authorized';
  end if;

  return query
  select assignment.id, mission.id, mission.slug, mission.title, mission.summary, mission.description,
    mission.category, culture.name, country.name, mission.min_age, mission.max_age,
    mission.estimated_minutes,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'step_id', step.id,
        'position', step.position,
        'title', step.title,
        'description', step.description
      ) order by step.position)
      from public.mission_steps step where step.mission_id = mission.id
    ), '[]'::jsonb),
    progress.id, progress.status, coalesce(progress.completed_step_ids, '{}'::uuid[]), progress.completed_at,
    assignment.created_at
  from public.village_missions assignment
  join public.cultural_missions mission on mission.id = assignment.mission_id and mission.active = true
  left join public.cultures culture on culture.id = mission.culture_id
  left join public.countries country on country.id = culture.country_id
  left join public.family_mission_progress progress
    on progress.village_mission_id = assignment.id and progress.family_id = family_uuid
  where assignment.village_id = p_village_id and assignment.status = 'active'
  order by assignment.created_at desc, assignment.id;
end;
$$;

create or replace function public.assign_village_mission(p_village_id uuid, p_mission_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_uuid uuid := public.current_profile_id();
  family_uuid uuid := kinavela_private.current_family_id(false);
  assignment_uuid uuid;
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  if family_uuid is null then raise exception 'family_not_found'; end if;
  if not exists (
    select 1 from public.village_members member
    where member.village_id = p_village_id and member.family_id = family_uuid
      and member.status = 'active' and member.role in ('owner', 'organizer')
  ) then raise exception 'not_authorized'; end if;
  if not exists (select 1 from public.cultural_missions where id = p_mission_id and active) then
    raise exception 'mission_not_available';
  end if;
  if (select count(*) from public.village_missions where village_id = p_village_id and status = 'active') >= 20 then
    raise exception 'village_mission_limit';
  end if;

  insert into public.village_missions(village_id, mission_id, assigned_by_profile_id, status)
  values (p_village_id, p_mission_id, profile_uuid, 'active')
  on conflict(village_id, mission_id) do update
    set status = 'active', assigned_by_profile_id = profile_uuid, updated_at = now()
  returning id into assignment_uuid;
  insert into public.audit_events(actor_profile_id, event_type, entity_type, entity_id, metadata)
  values (profile_uuid, 'mission_assigned_to_village', 'village_mission', assignment_uuid,
    jsonb_build_object('village_id', p_village_id, 'mission_id', p_mission_id));
  return assignment_uuid;
end;
$$;

create or replace function public.start_cultural_mission(
  p_mission_id uuid,
  p_village_mission_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_uuid uuid := public.current_profile_id();
  family_uuid uuid := kinavela_private.current_family_id(false);
  progress_uuid uuid;
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  if family_uuid is null then raise exception 'family_not_found'; end if;
  if not exists (select 1 from public.cultural_missions where id = p_mission_id and active) then
    raise exception 'mission_not_available';
  end if;
  if p_village_mission_id is not null and not exists (
    select 1 from public.village_missions assignment
    where assignment.id = p_village_mission_id and assignment.mission_id = p_mission_id
      and assignment.status = 'active'
      and kinavela_private.can_access_village(assignment.village_id, false)
  ) then raise exception 'village_mission_not_available'; end if;
  if not kinavela_private.can_manage_mission_family(family_uuid) then
    raise exception 'not_authorized';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'mission-progress:' || family_uuid::text || ':' || p_mission_id::text || ':' || coalesce(p_village_mission_id::text, 'library'), 0));
  select progress.id into progress_uuid
  from public.family_mission_progress progress
  where progress.family_id = family_uuid and progress.mission_id = p_mission_id
    and progress.village_mission_id is not distinct from p_village_mission_id
  for update;

  if progress_uuid is null then
    insert into public.family_mission_progress(
      family_id, mission_id, village_mission_id, started_by_profile_id
    ) values (family_uuid, p_mission_id, p_village_mission_id, profile_uuid)
    returning id into progress_uuid;
    insert into public.audit_events(actor_profile_id, event_type, entity_type, entity_id, metadata)
    values (profile_uuid, 'mission_started', 'mission_progress', progress_uuid,
      jsonb_build_object('mission_id', p_mission_id, 'village_mission_id', p_village_mission_id));
  end if;
  return progress_uuid;
end;
$$;

create or replace function public.complete_cultural_mission_step(
  p_mission_id uuid,
  p_step_id uuid,
  p_village_mission_id uuid default null
)
returns table (progress_id uuid, progress_status text, completed_step_ids uuid[], completed_at timestamptz, roots_ready boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_uuid uuid := public.current_profile_id();
  family_uuid uuid := kinavela_private.current_family_id(false);
  progress_row public.family_mission_progress%rowtype;
  step_count integer;
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  if family_uuid is null or not kinavela_private.can_manage_mission_family(family_uuid) then
    raise exception 'not_authorized';
  end if;
  if not exists (
    select 1 from public.mission_steps step
    join public.cultural_missions mission on mission.id = step.mission_id and mission.active
    where step.id = p_step_id and step.mission_id = p_mission_id
  ) then raise exception 'mission_step_not_available'; end if;
  if p_village_mission_id is not null and not exists (
    select 1 from public.village_missions assignment
    where assignment.id = p_village_mission_id and assignment.mission_id = p_mission_id
      and assignment.status = 'active'
      and kinavela_private.can_access_village(assignment.village_id, false)
  ) then raise exception 'village_mission_not_available'; end if;

  select * into progress_row
  from public.family_mission_progress progress
  where progress.family_id = family_uuid and progress.mission_id = p_mission_id
    and progress.village_mission_id is not distinct from p_village_mission_id
  for update;
  if progress_row.id is null then raise exception 'mission_not_started'; end if;

  if not (p_step_id = any(progress_row.completed_step_ids)) and progress_row.status <> 'completed' then
    progress_row.completed_step_ids := array_append(progress_row.completed_step_ids, p_step_id);
    select count(*) into step_count from public.mission_steps step where step.mission_id = p_mission_id;
    if cardinality(progress_row.completed_step_ids) >= step_count then
      progress_row.status := 'completed';
      progress_row.completed_at := now();
      progress_row.completed_by_profile_id := profile_uuid;
    end if;
    update public.family_mission_progress
    set completed_step_ids = progress_row.completed_step_ids,
      status = progress_row.status,
      completed_at = progress_row.completed_at,
      completed_by_profile_id = progress_row.completed_by_profile_id,
      updated_at = now()
    where id = progress_row.id;
    if progress_row.status = 'completed' then
      insert into public.audit_events(actor_profile_id, event_type, entity_type, entity_id, metadata)
      values (profile_uuid, 'mission_completed', 'mission_progress', progress_row.id,
        jsonb_build_object('mission_id', p_mission_id, 'village_mission_id', p_village_mission_id,
          'completed_step_count', cardinality(progress_row.completed_step_ids)));
    end if;
  end if;

  return query select progress_row.id, progress_row.status, progress_row.completed_step_ids,
    progress_row.completed_at, progress_row.status = 'completed';
end;
$$;

revoke all on function public.list_cultural_missions(),
  public.list_village_missions(uuid), public.assign_village_mission(uuid, uuid),
  public.start_cultural_mission(uuid, uuid),
  public.complete_cultural_mission_step(uuid, uuid, uuid)
  from public, anon, service_role;
grant execute on function public.list_cultural_missions(),
  public.list_village_missions(uuid), public.assign_village_mission(uuid, uuid),
  public.start_cultural_mission(uuid, uuid),
  public.complete_cultural_mission_step(uuid, uuid, uuid)
  to authenticated;

insert into kinavela_private.schema_migrations(version)
values ('202608110001_cultural_missions')
on conflict (version) do nothing;

notify pgrst, 'reload schema';

commit;
