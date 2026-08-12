begin;

create table public.villages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 3 and 100),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,140}$'),
  description text not null check (char_length(btrim(description)) between 10 and 1000),
  village_type text not null default 'local' check (village_type in ('local', 'culture', 'language', 'activity', 'temporary')),
  country_focus_id uuid references public.countries(id) on delete restrict,
  city text not null check (char_length(city) between 2 and 120),
  center_location extensions.geography(Point, 4326) not null,
  radius_km integer not null default 40 check (radius_km between 5 and 100),
  visibility text not null default 'listed' check (visibility in ('listed', 'private')),
  created_by_family_id uuid not null references public.families(id) on delete restrict,
  created_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  member_limit integer not null default 30 check (member_limit between 3 and 100),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index villages_location_idx on public.villages using gist(center_location);
create index villages_listed_city_idx on public.villages(status, visibility, city);
create index villages_creator_time_idx on public.villages(created_by_family_id, created_at desc);

create table public.village_members (
  id uuid primary key default gen_random_uuid(),
  village_id uuid not null references public.villages(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'organizer', 'moderator', 'member')),
  status text not null default 'requested' check (status in ('requested', 'invited', 'active', 'declined', 'removed')),
  initiated_by_family_id uuid not null references public.families(id) on delete restrict,
  joined_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(village_id, family_id),
  check ((status = 'active' and joined_at is not null) or status <> 'active')
);

create unique index village_single_active_owner_idx
  on public.village_members(village_id)
  where role = 'owner' and status = 'active';
create index village_members_family_status_idx
  on public.village_members(family_id, status, updated_at desc);
create index village_members_village_status_idx
  on public.village_members(village_id, status, role);

create table public.village_moderation_actions (
  id uuid primary key default gen_random_uuid(),
  village_id uuid not null references public.villages(id) on delete cascade,
  actor_profile_id uuid not null references public.profiles(id) on delete restrict,
  actor_family_id uuid not null references public.families(id) on delete restrict,
  action_type text not null check (action_type in (
    'join_approved', 'join_declined', 'family_invited', 'invite_accepted',
    'invite_declined', 'role_changed', 'ownership_transferred',
    'member_left', 'member_removed', 'message_removed', 'report_dismissed'
  )),
  target_family_id uuid references public.families(id) on delete set null,
  target_message_id uuid,
  report_id uuid references public.reports(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index village_moderation_actions_village_time_idx
  on public.village_moderation_actions(village_id, created_at desc);

create trigger villages_set_updated_at before update on public.villages
  for each row execute function public.set_updated_at();
create trigger village_members_set_updated_at before update on public.village_members
  for each row execute function public.set_updated_at();

alter table public.conversations alter column family_connection_id drop not null;
alter table public.conversations add column village_id uuid unique references public.villages(id) on delete cascade;
alter table public.conversations drop constraint if exists conversations_check;
alter table public.conversations drop constraint if exists conversations_conversation_type_check1;
alter table public.conversations drop constraint if exists conversations_conversation_type_check;
alter table public.conversations add constraint conversations_conversation_type_check
  check (conversation_type in ('family', 'village'));
alter table public.conversations add constraint conversations_resource_check check (
  (conversation_type = 'family' and family_connection_id is not null and village_id is null)
  or (conversation_type = 'village' and family_connection_id is null and village_id is not null)
);

alter table public.reports alter column target_family_id drop not null;
alter table public.reports add column target_village_id uuid references public.villages(id) on delete set null;
alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports drop constraint if exists reports_check;
alter table public.reports drop constraint if exists reports_check1;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('family', 'message', 'village'));
alter table public.reports add constraint reports_target_shape_check check (
  (target_type = 'family' and target_family_id is not null and target_message_id is null and conversation_id is null and target_village_id is null)
  or (target_type = 'message' and target_family_id is not null and target_message_id is not null and conversation_id is not null)
  or (target_type = 'village' and target_village_id is not null and target_family_id is null and target_message_id is null and conversation_id is null)
);
alter table public.reports add constraint reports_distinct_family_check
  check (target_family_id is null or reporter_family_id <> target_family_id);
create index reports_target_village_idx on public.reports(target_village_id, status, created_at desc);

alter table public.villages enable row level security;
alter table public.villages force row level security;
alter table public.village_members enable row level security;
alter table public.village_members force row level security;
alter table public.village_moderation_actions enable row level security;
alter table public.village_moderation_actions force row level security;

create or replace function kinavela_private.is_village_family_member(
  p_village_id uuid,
  p_family_id uuid,
  p_moderator_required boolean default false
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.village_members vm
    join public.villages v on v.id = vm.village_id
    where vm.village_id = p_village_id
      and vm.family_id = p_family_id
      and vm.status = 'active'
      and v.status = 'active'
      and (not p_moderator_required or vm.role in ('owner', 'organizer', 'moderator'))
  )
$$;

create or replace function kinavela_private.can_access_village(
  p_village_id uuid,
  p_moderator_required boolean default false
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.family_members fm on fm.profile_id = p.id
    join public.village_members vm on vm.family_id = fm.family_id
    join public.villages v on v.id = vm.village_id
    where p.auth_user_id = auth.uid()
      and p.status = 'active'
      and fm.status = 'active'
      and vm.village_id = p_village_id
      and vm.status = 'active'
      and v.status = 'active'
      and (not p_moderator_required or vm.role in ('owner', 'organizer', 'moderator'))
  )
$$;

create or replace function kinavela_private.can_access_village_conversation(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversations c
    where c.id = p_conversation_id
      and c.conversation_type = 'village'
      and kinavela_private.can_access_village(c.village_id, false)
  )
$$;

revoke all on function kinavela_private.is_village_family_member(uuid, uuid, boolean),
  kinavela_private.can_access_village(uuid, boolean),
  kinavela_private.can_access_village_conversation(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.can_access_village(p_village_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select kinavela_private.can_access_village(p_village_id, false) $$;

create or replace function public.can_access_village_conversation(p_conversation_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select kinavela_private.can_access_village_conversation(p_conversation_id) $$;

create or replace function public.can_moderate_village(p_village_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select kinavela_private.can_access_village(p_village_id, true) $$;

revoke all on function public.can_access_village(uuid),
  public.can_access_village_conversation(uuid), public.can_moderate_village(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.can_access_village(uuid),
  public.can_access_village_conversation(uuid), public.can_moderate_village(uuid)
  to authenticated;

create policy "Members read their villages" on public.villages for select to authenticated
  using (public.can_access_village(id));
create policy "Members read Village memberships" on public.village_members for select to authenticated
  using (public.can_access_village(village_id));
create policy "Moderators read Village action log" on public.village_moderation_actions for select to authenticated
  using (public.can_moderate_village(village_id));

drop policy "Connected families read conversations" on public.conversations;
create policy "Authorized members read conversations" on public.conversations for select to authenticated
  using (public.can_access_family_conversation(id) or public.can_access_village_conversation(id));
drop policy "Connected families read participants" on public.conversation_participants;
create policy "Authorized members read participants" on public.conversation_participants for select to authenticated
  using (public.can_access_family_conversation(conversation_id) or public.can_access_village_conversation(conversation_id));
drop policy "Connected families read messages" on public.messages;
create policy "Authorized members read messages" on public.messages for select to authenticated
  using (
    deleted_at is null
    and (public.can_access_family_conversation(conversation_id) or public.can_access_village_conversation(conversation_id))
  );

revoke all on public.villages, public.village_members, public.village_moderation_actions
  from public, anon, authenticated;

create or replace function public.create_village(
  p_name text,
  p_description text,
  p_village_type text default 'local',
  p_country_focus_id uuid default null,
  p_radius_km integer default 40,
  p_visibility text default 'listed',
  p_member_limit integer default 30
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_uuid uuid := public.current_profile_id();
  family_uuid uuid := kinavela_private.current_family_id(true);
  family_row public.families%rowtype;
  village_uuid uuid := gen_random_uuid();
  conversation_uuid uuid;
  clean_name text := btrim(p_name);
  clean_description text := btrim(p_description);
  slug_base text;
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  if family_uuid is null then raise exception 'not_authorized'; end if;
  if char_length(clean_name) not between 3 and 100 or char_length(clean_description) not between 10 and 1000 then
    raise exception 'invalid_village';
  end if;
  if p_village_type not in ('local', 'culture', 'language', 'activity', 'temporary')
     or p_visibility not in ('listed', 'private')
     or p_radius_km not between 5 and 100
     or p_member_limit not between 3 and 100 then raise exception 'invalid_village'; end if;
  if p_country_focus_id is not null and not exists (select 1 from public.countries where id = p_country_focus_id) then
    raise exception 'invalid_country_focus';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('village-create:' || family_uuid::text, 0));
  if (select count(*) from public.villages where created_by_family_id = family_uuid and created_at >= clock_timestamp() - interval '24 hours') >= 3 then
    raise exception 'village_create_rate_limited';
  end if;
  if (select count(*) from public.village_members where family_id = family_uuid and role = 'owner' and status = 'active') >= 5 then
    raise exception 'village_owner_limit';
  end if;
  select * into family_row from public.families where id = family_uuid for share;
  if family_row.location is null then raise exception 'location_required'; end if;

  slug_base := trim(both '-' from regexp_replace(lower(clean_name), '[^a-z0-9]+', '-', 'g'));
  if char_length(slug_base) < 3 then slug_base := 'village'; end if;
  slug_base := left(slug_base, 125) || '-' || left(replace(village_uuid::text, '-', ''), 10);

  insert into public.villages(
    id, name, slug, description, village_type, country_focus_id, city,
    center_location, radius_km, visibility, created_by_family_id,
    created_by_profile_id, member_limit
  ) values (
    village_uuid, clean_name, slug_base, clean_description, p_village_type,
    p_country_focus_id, family_row.city, family_row.location, p_radius_km,
    p_visibility, family_uuid, profile_uuid, p_member_limit
  );
  insert into public.village_members(village_id, family_id, role, status, initiated_by_family_id, joined_at, responded_at)
  values (village_uuid, family_uuid, 'owner', 'active', family_uuid, now(), now());
  insert into public.conversations(conversation_type, village_id, created_by_profile_id)
  values ('village', village_uuid, profile_uuid) returning id into conversation_uuid;
  insert into public.conversation_participants(conversation_id, family_id, profile_id)
  select conversation_uuid, fm.family_id, fm.profile_id from public.family_members fm
  join public.profiles p on p.id = fm.profile_id and p.status = 'active'
  where fm.family_id = family_uuid and fm.status = 'active'
  on conflict on constraint conversation_participants_conversation_id_profile_id_key do nothing;
  insert into public.audit_events(actor_profile_id, event_type, entity_type, entity_id)
  values (profile_uuid, 'village_created', 'village', village_uuid);
  return village_uuid;
end;
$$;

create or replace function public.list_my_villages()
returns table (
  village_id uuid, name text, city text, village_type text, member_role text,
  member_count integer, last_message_at timestamptz, muted boolean
)
language plpgsql security definer set search_path = '' as $$
declare
  profile_uuid uuid := public.current_profile_id();
  family_uuid uuid := kinavela_private.current_family_id(false);
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  return query
  select v.id, v.name, v.city, v.village_type, vm.role,
    (select count(*)::integer from public.village_members active_vm where active_vm.village_id = v.id and active_vm.status = 'active'),
    c.last_message_at, cp.muted_at is not null
  from public.villages v
  join public.village_members vm on vm.village_id = v.id and vm.family_id = family_uuid and vm.status = 'active'
  join public.conversations c on c.village_id = v.id and c.conversation_type = 'village'
  left join public.conversation_participants cp on cp.conversation_id = c.id and cp.profile_id = profile_uuid
  where v.status = 'active'
  order by coalesce(c.last_message_at, v.created_at) desc, v.id;
end;
$$;

create or replace function public.discover_villages()
returns table (
  village_id uuid, name text, description text, city text, village_type text,
  country_focus_name text, member_count integer, member_limit integer
)
language plpgsql stable security definer set search_path = '' as $$
declare
  profile_uuid uuid := public.current_profile_id();
  family_uuid uuid := kinavela_private.current_family_id(false);
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  if family_uuid is null then raise exception 'family_not_found'; end if;
  return query
  select v.id, v.name, v.description, v.city, v.village_type, country.name,
    (select count(*)::integer from public.village_members active_vm where active_vm.village_id = v.id and active_vm.status = 'active'),
    v.member_limit
  from public.villages v
  join public.families requester on requester.id = family_uuid
  left join public.countries country on country.id = v.country_focus_id
  where v.status = 'active' and v.visibility = 'listed'
    and requester.location is not null
    and extensions.st_dwithin(requester.location, v.center_location, least(requester.discovery_radius_km, v.radius_km) * 1000.0)
    and not exists (select 1 from public.village_members own_vm where own_vm.village_id = v.id and own_vm.family_id = family_uuid and own_vm.status in ('active', 'requested', 'invited'))
    and not exists (
      select 1 from public.village_members other_vm
      join public.discovery_blocks db on (
        (db.blocker_family_id = family_uuid and db.blocked_family_id = other_vm.family_id)
        or (db.blocked_family_id = family_uuid and db.blocker_family_id = other_vm.family_id)
      ) where other_vm.village_id = v.id and other_vm.status = 'active'
    )
  order by v.created_at desc, v.id;
end;
$$;

create or replace function public.list_village_invitations()
returns table (village_id uuid, village_name text, city text, inviter_family_name text, invited_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  profile_uuid uuid := public.current_profile_id();
  family_uuid uuid := kinavela_private.current_family_id(false);
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  return query select v.id, v.name, v.city, f.name, vm.created_at
  from public.village_members vm
  join public.villages v on v.id = vm.village_id and v.status = 'active'
  join public.families f on f.id = vm.initiated_by_family_id
  where vm.family_id = family_uuid and vm.status = 'invited'
  order by vm.created_at desc;
end;
$$;

create or replace function public.get_village(p_village_id uuid)
returns table (
  village_id uuid, name text, description text, city text, village_type text,
  country_focus_name text, radius_km integer, visibility text, member_limit integer,
  member_count integer, member_role text, conversation_id uuid, muted boolean,
  can_moderate boolean, can_manage_roles boolean
)
language plpgsql security definer set search_path = '' as $$
declare
  profile_uuid uuid := public.current_profile_id();
  family_uuid uuid := kinavela_private.current_family_id(false);
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  if not kinavela_private.can_access_village(p_village_id, false) then raise exception 'village_not_available'; end if;
  insert into public.conversation_participants(conversation_id, family_id, profile_id)
  select c.id, family_uuid, profile_uuid from public.conversations c where c.village_id = p_village_id
  on conflict on constraint conversation_participants_conversation_id_profile_id_key do nothing;
  return query select v.id, v.name, v.description, v.city, v.village_type, country.name,
    v.radius_km, v.visibility, v.member_limit,
    (select count(*)::integer from public.village_members active_vm where active_vm.village_id = v.id and active_vm.status = 'active'),
    vm.role, c.id, cp.muted_at is not null,
    vm.role in ('owner', 'organizer', 'moderator'), vm.role = 'owner'
  from public.villages v
  join public.village_members vm on vm.village_id = v.id and vm.family_id = family_uuid and vm.status = 'active'
  join public.conversations c on c.village_id = v.id
  join public.conversation_participants cp on cp.conversation_id = c.id and cp.profile_id = profile_uuid
  left join public.countries country on country.id = v.country_focus_id
  where v.id = p_village_id and v.status = 'active';
end;
$$;

create or replace function public.list_village_members(p_village_id uuid)
returns table (family_id uuid, family_name text, city text, role text, joined_at timestamptz, is_current_family boolean)
language plpgsql stable security definer set search_path = '' as $$
declare family_uuid uuid := kinavela_private.current_family_id(false);
begin
  if public.current_profile_id() is null then raise exception 'not_authenticated'; end if;
  if not kinavela_private.can_access_village(p_village_id, false) then raise exception 'village_not_available'; end if;
  return query select f.id, f.name, f.city, vm.role, vm.joined_at, f.id = family_uuid
  from public.village_members vm join public.families f on f.id = vm.family_id
  where vm.village_id = p_village_id and vm.status = 'active'
  order by case vm.role when 'owner' then 1 when 'organizer' then 2 when 'moderator' then 3 else 4 end, vm.joined_at, f.id;
end;
$$;

create or replace function public.list_village_membership_requests(p_village_id uuid)
returns table (family_id uuid, family_name text, city text, requested_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not kinavela_private.can_access_village(p_village_id, true) then raise exception 'not_authorized'; end if;
  return query select f.id, f.name, f.city, vm.created_at
  from public.village_members vm join public.families f on f.id = vm.family_id
  where vm.village_id = p_village_id and vm.status = 'requested'
  order by vm.created_at;
end;
$$;

create or replace function public.request_village_membership(p_village_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  profile_uuid uuid := public.current_profile_id();
  family_uuid uuid := kinavela_private.current_family_id(true);
  village_row public.villages%rowtype;
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  if family_uuid is null then raise exception 'not_authorized'; end if;
  select * into village_row from public.villages where id = p_village_id and status = 'active' and visibility = 'listed' for update;
  if village_row.id is null then raise exception 'village_not_available'; end if;
  if not exists (select 1 from public.families where id = family_uuid and location is not null and extensions.st_dwithin(location, village_row.center_location, least(discovery_radius_km, village_row.radius_km) * 1000.0)) then
    raise exception 'village_not_available';
  end if;
  if exists (
    select 1 from public.village_members other_vm join public.discovery_blocks db on (
      (db.blocker_family_id = family_uuid and db.blocked_family_id = other_vm.family_id)
      or (db.blocked_family_id = family_uuid and db.blocker_family_id = other_vm.family_id)
    ) where other_vm.village_id = p_village_id and other_vm.status = 'active'
  ) then raise exception 'village_not_available'; end if;
  insert into public.village_members(village_id, family_id, role, status, initiated_by_family_id, joined_at, responded_at)
  values (p_village_id, family_uuid, 'member', 'requested', family_uuid, null, null)
  on conflict(village_id, family_id) do update set role = 'member', status = 'requested', initiated_by_family_id = family_uuid, joined_at = null, responded_at = null, updated_at = now()
  where public.village_members.status in ('declined', 'removed');
  if not found then raise exception 'membership_already_exists'; end if;
  return true;
end;
$$;

create or replace function public.invite_family_to_village(p_village_id uuid, p_family_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  profile_uuid uuid := public.current_profile_id();
  family_uuid uuid := kinavela_private.current_family_id(false);
begin
  if not kinavela_private.can_access_village(p_village_id, true) then raise exception 'not_authorized'; end if;
  if family_uuid = p_family_id or not kinavela_private.families_are_connected(family_uuid, p_family_id) then raise exception 'family_not_available'; end if;
  perform 1 from public.villages where id = p_village_id and status = 'active' for update;
  insert into public.village_members(village_id, family_id, role, status, initiated_by_family_id)
  values (p_village_id, p_family_id, 'member', 'invited', family_uuid)
  on conflict(village_id, family_id) do update set role = 'member', status = 'invited', initiated_by_family_id = family_uuid, joined_at = null, responded_at = null, updated_at = now()
  where public.village_members.status in ('declined', 'removed');
  if not found then raise exception 'membership_already_exists'; end if;
  insert into public.village_moderation_actions(village_id, actor_profile_id, actor_family_id, action_type, target_family_id)
  values (p_village_id, profile_uuid, family_uuid, 'family_invited', p_family_id);
  return true;
end;
$$;

create or replace function kinavela_private.activate_village_family(p_village_id uuid, p_family_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare conversation_uuid uuid;
begin
  perform 1 from public.villages where id = p_village_id and status = 'active' for update;
  if (select count(*) from public.village_members where village_id = p_village_id and status = 'active') >=
     (select member_limit from public.villages where id = p_village_id) then raise exception 'village_full'; end if;
  if exists (
    select 1 from public.village_members other_vm
    join public.discovery_blocks db on (
      (db.blocker_family_id = p_family_id and db.blocked_family_id = other_vm.family_id)
      or (db.blocked_family_id = p_family_id and db.blocker_family_id = other_vm.family_id)
    ) where other_vm.village_id = p_village_id and other_vm.status = 'active'
  ) then raise exception 'village_not_available'; end if;
  update public.village_members set status = 'active', joined_at = now(), responded_at = now()
  where village_id = p_village_id and family_id = p_family_id;
  select id into conversation_uuid from public.conversations where village_id = p_village_id;
  insert into public.conversation_participants(conversation_id, family_id, profile_id)
  select conversation_uuid, fm.family_id, fm.profile_id from public.family_members fm
  join public.profiles p on p.id = fm.profile_id and p.status = 'active'
  where fm.family_id = p_family_id and fm.status = 'active'
  on conflict on constraint conversation_participants_conversation_id_profile_id_key do nothing;
end;
$$;
revoke all on function kinavela_private.activate_village_family(uuid, uuid) from public, anon, authenticated, service_role;

create or replace function public.respond_village_invitation(p_village_id uuid, p_accept boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  profile_uuid uuid := public.current_profile_id();
  family_uuid uuid := kinavela_private.current_family_id(true);
  inviter_uuid uuid;
begin
  if profile_uuid is null or family_uuid is null then raise exception 'not_authorized'; end if;
  select initiated_by_family_id into inviter_uuid from public.village_members
  where village_id = p_village_id and family_id = family_uuid and status = 'invited' for update;
  if inviter_uuid is null then raise exception 'invitation_not_available'; end if;
  if p_accept then
    perform kinavela_private.activate_village_family(p_village_id, family_uuid);
  else
    update public.village_members set status = 'declined', responded_at = now() where village_id = p_village_id and family_id = family_uuid;
  end if;
  insert into public.village_moderation_actions(village_id, actor_profile_id, actor_family_id, action_type, target_family_id)
  values (p_village_id, profile_uuid, family_uuid, case when p_accept then 'invite_accepted' else 'invite_declined' end, family_uuid);
  return true;
end;
$$;

create or replace function public.respond_village_join_request(p_village_id uuid, p_family_id uuid, p_accept boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  profile_uuid uuid := public.current_profile_id();
  family_uuid uuid := kinavela_private.current_family_id(false);
begin
  if not kinavela_private.can_access_village(p_village_id, true) then raise exception 'not_authorized'; end if;
  perform 1 from public.village_members where village_id = p_village_id and family_id = p_family_id and status = 'requested' for update;
  if not found then raise exception 'request_not_available'; end if;
  if p_accept then perform kinavela_private.activate_village_family(p_village_id, p_family_id);
  else update public.village_members set status = 'declined', responded_at = now() where village_id = p_village_id and family_id = p_family_id;
  end if;
  insert into public.village_moderation_actions(village_id, actor_profile_id, actor_family_id, action_type, target_family_id)
  values (p_village_id, profile_uuid, family_uuid, case when p_accept then 'join_approved' else 'join_declined' end, p_family_id);
  return true;
end;
$$;

create or replace function public.set_village_member_role(p_village_id uuid, p_family_id uuid, p_role text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  profile_uuid uuid := public.current_profile_id();
  family_uuid uuid := kinavela_private.current_family_id(false);
begin
  if p_role not in ('owner', 'organizer', 'moderator', 'member') then raise exception 'invalid_role'; end if;
  if not exists (select 1 from public.village_members where village_id = p_village_id and family_id = family_uuid and status = 'active' and role = 'owner') then raise exception 'not_authorized'; end if;
  if not exists (select 1 from public.village_members where village_id = p_village_id and family_id = p_family_id and status = 'active') then raise exception 'member_not_available'; end if;
  if p_role = 'owner' then
    if p_family_id = family_uuid then return true; end if;
    update public.village_members set role = 'organizer' where village_id = p_village_id and family_id = family_uuid;
    update public.village_members set role = 'owner' where village_id = p_village_id and family_id = p_family_id;
    insert into public.village_moderation_actions(village_id, actor_profile_id, actor_family_id, action_type, target_family_id)
    values (p_village_id, profile_uuid, family_uuid, 'ownership_transferred', p_family_id);
  else
    if p_family_id = family_uuid then raise exception 'owner_cannot_self_demote'; end if;
    update public.village_members set role = p_role where village_id = p_village_id and family_id = p_family_id and role <> 'owner';
    if not found then raise exception 'member_not_available'; end if;
    insert into public.village_moderation_actions(village_id, actor_profile_id, actor_family_id, action_type, target_family_id, metadata)
    values (p_village_id, profile_uuid, family_uuid, 'role_changed', p_family_id, jsonb_build_object('role', p_role));
  end if;
  return true;
end;
$$;

create or replace function public.leave_village(p_village_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare profile_uuid uuid := public.current_profile_id(); family_uuid uuid := kinavela_private.current_family_id(true); membership_role text;
begin
  select role into membership_role from public.village_members where village_id = p_village_id and family_id = family_uuid and status = 'active' for update;
  if membership_role is null then raise exception 'membership_not_available'; end if;
  if membership_role = 'owner' then raise exception 'transfer_ownership_required'; end if;
  update public.village_members set status = 'removed', responded_at = now() where village_id = p_village_id and family_id = family_uuid;
  delete from public.conversation_participants cp using public.conversations c where cp.conversation_id = c.id and c.village_id = p_village_id and cp.family_id = family_uuid;
  insert into public.village_moderation_actions(village_id, actor_profile_id, actor_family_id, action_type, target_family_id)
  values (p_village_id, profile_uuid, family_uuid, 'member_left', family_uuid);
  return true;
end;
$$;

create or replace function public.remove_village_member(p_village_id uuid, p_family_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare profile_uuid uuid := public.current_profile_id(); family_uuid uuid := kinavela_private.current_family_id(false); actor_role text; target_role text;
begin
  select role into actor_role from public.village_members where village_id = p_village_id and family_id = family_uuid and status = 'active';
  select role into target_role from public.village_members where village_id = p_village_id and family_id = p_family_id and status = 'active' for update;
  if actor_role not in ('owner', 'organizer', 'moderator') or target_role is null or target_role = 'owner' or p_family_id = family_uuid then raise exception 'not_authorized'; end if;
  if actor_role <> 'owner' and target_role <> 'member' then raise exception 'not_authorized'; end if;
  update public.village_members set status = 'removed', responded_at = now() where village_id = p_village_id and family_id = p_family_id;
  delete from public.conversation_participants cp using public.conversations c where cp.conversation_id = c.id and c.village_id = p_village_id and cp.family_id = p_family_id;
  insert into public.village_moderation_actions(village_id, actor_profile_id, actor_family_id, action_type, target_family_id)
  values (p_village_id, profile_uuid, family_uuid, 'member_removed', p_family_id);
  insert into public.audit_events(actor_profile_id, event_type, entity_type, entity_id, metadata)
  values (profile_uuid, 'member_removed', 'village', p_village_id, jsonb_build_object('target_family_id', p_family_id));
  return true;
end;
$$;

create or replace function public.list_village_messages(p_village_id uuid, p_before timestamptz default null, p_limit integer default 50)
returns table (
  message_id uuid, conversation_id uuid, sender_profile_id uuid, sender_family_id uuid,
  sender_display_name text, body text, reply_to uuid, is_own_family boolean, created_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
declare family_uuid uuid := kinavela_private.current_family_id(false); conversation_uuid uuid;
begin
  if public.current_profile_id() is null then raise exception 'not_authenticated'; end if;
  if p_limit not between 1 and 100 then raise exception 'invalid_limit'; end if;
  if not kinavela_private.can_access_village(p_village_id, false) then raise exception 'village_not_available'; end if;
  select id into conversation_uuid from public.conversations where village_id = p_village_id;
  return query select m.id, m.conversation_id, m.sender_profile_id, m.sender_family_id, p.display_name,
    m.body, m.reply_to, m.sender_family_id = family_uuid, m.created_at
  from public.messages m join public.profiles p on p.id = m.sender_profile_id
  where m.conversation_id = conversation_uuid and m.deleted_at is null and (p_before is null or m.created_at < p_before)
  order by m.created_at desc, m.id desc limit p_limit;
end;
$$;

create or replace function public.send_village_message(p_village_id uuid, p_body text, p_reply_to uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare profile_uuid uuid := public.current_profile_id(); family_uuid uuid := kinavela_private.current_family_id(false); conversation_uuid uuid; message_uuid uuid; clean_body text := btrim(p_body);
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  if not kinavela_private.can_access_village(p_village_id, false) then raise exception 'village_not_available'; end if;
  if char_length(clean_body) not between 1 and 2000 then raise exception 'invalid_message'; end if;
  select id into conversation_uuid from public.conversations where village_id = p_village_id for update;
  insert into public.messages(conversation_id, sender_profile_id, sender_family_id, body, reply_to)
  values (conversation_uuid, profile_uuid, family_uuid, clean_body, p_reply_to) returning id into message_uuid;
  update public.conversations set last_message_at = now() where id = conversation_uuid;
  return message_uuid;
end;
$$;

create or replace function public.set_village_conversation_muted(p_village_id uuid, p_muted boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare profile_uuid uuid := public.current_profile_id(); family_uuid uuid := kinavela_private.current_family_id(false); conversation_uuid uuid;
begin
  if not kinavela_private.can_access_village(p_village_id, false) then raise exception 'village_not_available'; end if;
  select id into conversation_uuid from public.conversations where village_id = p_village_id;
  insert into public.conversation_participants(conversation_id, family_id, profile_id, muted_at)
  values (conversation_uuid, family_uuid, profile_uuid, case when p_muted then now() else null end)
  on conflict on constraint conversation_participants_conversation_id_profile_id_key do update set muted_at = case when p_muted then now() else null end;
  return true;
end;
$$;

create or replace function public.submit_village_report(p_village_id uuid, p_message_id uuid default null, p_reason text default 'other', p_details text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare profile_uuid uuid := public.current_profile_id(); family_uuid uuid := kinavela_private.current_family_id(false); conversation_uuid uuid; target_family_uuid uuid; report_uuid uuid; clean_details text := nullif(btrim(coalesce(p_details, '')), '');
begin
  if not kinavela_private.can_access_village(p_village_id, false) then raise exception 'village_not_available'; end if;
  if p_reason not in ('harassment', 'spam', 'fraud', 'unsafe_behavior', 'inappropriate_child_content', 'discrimination', 'impersonation', 'other') then raise exception 'invalid_report_reason'; end if;
  if clean_details is not null and char_length(clean_details) > 1000 then raise exception 'invalid_report_details'; end if;
  if p_message_id is null then
    insert into public.reports(reporter_profile_id, reporter_family_id, target_type, target_village_id, reason, details)
    values (profile_uuid, family_uuid, 'village', p_village_id, p_reason, clean_details) returning id into report_uuid;
  else
    select m.conversation_id, m.sender_family_id into conversation_uuid, target_family_uuid
    from public.messages m join public.conversations c on c.id = m.conversation_id
    where m.id = p_message_id and c.village_id = p_village_id and m.deleted_at is null;
    if conversation_uuid is null or target_family_uuid = family_uuid then raise exception 'report_target_not_available'; end if;
    insert into public.reports(reporter_profile_id, reporter_family_id, target_type, target_family_id, target_message_id, conversation_id, target_village_id, reason, details)
    values (profile_uuid, family_uuid, 'message', target_family_uuid, p_message_id, conversation_uuid, p_village_id, p_reason, clean_details) returning id into report_uuid;
  end if;
  insert into public.audit_events(actor_profile_id, event_type, entity_type, entity_id) values (profile_uuid, 'report_submitted', 'report', report_uuid);
  return report_uuid;
end;
$$;

create or replace function public.list_village_reports(p_village_id uuid)
returns table (report_id uuid, target_type text, target_family_id uuid, target_family_name text, target_message_id uuid, reason text, details text, status text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not kinavela_private.can_access_village(p_village_id, true) then raise exception 'not_authorized'; end if;
  return query select r.id, r.target_type, r.target_family_id, f.name, r.target_message_id, r.reason, r.details, r.status, r.created_at
  from public.reports r left join public.families f on f.id = r.target_family_id
  where r.target_village_id = p_village_id and r.status in ('open', 'reviewing') order by r.created_at;
end;
$$;

create or replace function public.resolve_village_report(p_report_id uuid, p_resolution text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare profile_uuid uuid := public.current_profile_id(); family_uuid uuid := kinavela_private.current_family_id(false); report_row public.reports%rowtype; target_role text;
begin
  if p_resolution not in ('dismiss', 'delete_message', 'remove_member') then raise exception 'invalid_resolution'; end if;
  select * into report_row from public.reports where id = p_report_id and status in ('open', 'reviewing') for update;
  if report_row.id is null or report_row.target_village_id is null or not kinavela_private.can_access_village(report_row.target_village_id, true) then raise exception 'report_not_available'; end if;
  if p_resolution = 'delete_message' then
    if report_row.target_message_id is null then raise exception 'invalid_resolution'; end if;
    update public.messages set deleted_at = now()
    where id = report_row.target_message_id and conversation_id = report_row.conversation_id and deleted_at is null;
    if not found then raise exception 'message_not_available'; end if;
    insert into public.village_moderation_actions(village_id, actor_profile_id, actor_family_id, action_type, target_family_id, target_message_id, report_id)
    values (report_row.target_village_id, profile_uuid, family_uuid, 'message_removed', report_row.target_family_id, report_row.target_message_id, report_row.id);
  elsif p_resolution = 'remove_member' then
    if report_row.target_family_id is null then raise exception 'invalid_resolution'; end if;
    select role into target_role from public.village_members where village_id = report_row.target_village_id and family_id = report_row.target_family_id and status = 'active';
    if target_role is null or target_role = 'owner' then raise exception 'not_authorized'; end if;
    perform public.remove_village_member(report_row.target_village_id, report_row.target_family_id);
  else
    insert into public.village_moderation_actions(village_id, actor_profile_id, actor_family_id, action_type, target_family_id, target_message_id, report_id)
    values (report_row.target_village_id, profile_uuid, family_uuid, 'report_dismissed', report_row.target_family_id, report_row.target_message_id, report_row.id);
  end if;
  update public.reports set status = case when p_resolution = 'dismiss' then 'dismissed' else 'resolved' end where id = report_row.id;
  return true;
end;
$$;

create or replace function kinavela_private.enforce_message_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare connection public.family_connections%rowtype; conversation_row public.conversations%rowtype; recent_minute integer; recent_day integer;
begin
  new.body := btrim(new.body);
  if char_length(new.body) not between 1 and 2000 or new.message_type <> 'text' then raise exception 'invalid_message'; end if;
  perform pg_advisory_xact_lock(hashtextextended('message-rate:' || new.sender_profile_id::text, 0));
  select * into conversation_row from public.conversations where id = new.conversation_id for update;
  if conversation_row.id is null then raise exception 'conversation_not_available'; end if;
  if conversation_row.conversation_type = 'family' then
    select * into connection from public.family_connections where id = conversation_row.family_connection_id for update;
    if connection.id is null or connection.status <> 'accepted' or not kinavela_private.families_are_connected(connection.requester_family_id, connection.recipient_family_id) or new.sender_family_id not in (connection.requester_family_id, connection.recipient_family_id) then raise exception 'conversation_not_available'; end if;
  elsif conversation_row.conversation_type = 'village' then
    if not kinavela_private.is_village_family_member(conversation_row.village_id, new.sender_family_id, false) then raise exception 'conversation_not_available'; end if;
  else raise exception 'conversation_not_available';
  end if;
  if not exists (select 1 from public.family_members fm join public.profiles p on p.id = fm.profile_id where fm.family_id = new.sender_family_id and fm.profile_id = new.sender_profile_id and fm.status = 'active' and p.status = 'active') then raise exception 'not_authorized'; end if;
  if new.reply_to is not null and not exists (select 1 from public.messages reply where reply.id = new.reply_to and reply.conversation_id = new.conversation_id and reply.deleted_at is null) then raise exception 'invalid_reply'; end if;
  select count(*) into recent_minute from public.messages where sender_profile_id = new.sender_profile_id and created_at >= clock_timestamp() - interval '1 minute';
  select count(*) into recent_day from public.messages where sender_profile_id = new.sender_profile_id and created_at >= clock_timestamp() - interval '24 hours';
  if recent_minute >= 30 or recent_day >= 500 then raise exception 'message_rate_limited'; end if;
  return new;
end;
$$;

create or replace function kinavela_private.enforce_report_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare recent_reports integer;
begin
  new.details := nullif(btrim(coalesce(new.details, '')), '');
  if new.details is not null and char_length(new.details) > 1000 then raise exception 'invalid_report_details'; end if;
  perform pg_advisory_xact_lock(hashtextextended('report-rate:' || new.reporter_profile_id::text, 0));
  select count(*) into recent_reports from public.reports where reporter_profile_id = new.reporter_profile_id and created_at >= clock_timestamp() - interval '24 hours';
  if recent_reports >= 5 then raise exception 'report_rate_limited'; end if;
  if not exists (select 1 from public.family_members fm join public.profiles p on p.id = fm.profile_id where fm.family_id = new.reporter_family_id and fm.profile_id = new.reporter_profile_id and fm.status = 'active' and p.status = 'active') then raise exception 'not_authorized'; end if;
  if new.target_type = 'family' then
    if new.target_message_id is not null or new.conversation_id is not null or new.target_village_id is not null or not exists (select 1 from public.family_connections fc where new.reporter_family_id in (fc.requester_family_id, fc.recipient_family_id) and new.target_family_id in (fc.requester_family_id, fc.recipient_family_id)) then raise exception 'report_target_not_available'; end if;
  elsif new.target_type = 'village' then
    if not kinavela_private.is_village_family_member(new.target_village_id, new.reporter_family_id, false) then raise exception 'report_target_not_available'; end if;
  elsif new.target_type = 'message' then
    if not exists (
      select 1 from public.messages m join public.conversations c on c.id = m.conversation_id
      where m.id = new.target_message_id and m.conversation_id = new.conversation_id and m.sender_family_id = new.target_family_id
        and ((c.conversation_type = 'family' and kinavela_private.can_access_family_conversation(c.id, true))
          or (c.conversation_type = 'village' and c.village_id = new.target_village_id and kinavela_private.is_village_family_member(c.village_id, new.reporter_family_id, false)))
    ) then raise exception 'report_target_not_available'; end if;
  else raise exception 'invalid_report_target'; end if;
  return new;
end;
$$;

revoke all on function kinavela_private.enforce_message_insert(), kinavela_private.enforce_report_insert()
  from public, anon, authenticated, service_role;

revoke all on function public.create_village(text, text, text, uuid, integer, text, integer),
  public.list_my_villages(), public.discover_villages(), public.list_village_invitations(),
  public.get_village(uuid), public.list_village_members(uuid), public.list_village_membership_requests(uuid),
  public.request_village_membership(uuid), public.invite_family_to_village(uuid, uuid),
  public.respond_village_invitation(uuid, boolean), public.respond_village_join_request(uuid, uuid, boolean),
  public.set_village_member_role(uuid, uuid, text), public.leave_village(uuid), public.remove_village_member(uuid, uuid),
  public.list_village_messages(uuid, timestamptz, integer), public.send_village_message(uuid, text, uuid),
  public.set_village_conversation_muted(uuid, boolean), public.submit_village_report(uuid, uuid, text, text),
  public.list_village_reports(uuid), public.resolve_village_report(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.create_village(text, text, text, uuid, integer, text, integer),
  public.list_my_villages(), public.discover_villages(), public.list_village_invitations(),
  public.get_village(uuid), public.list_village_members(uuid), public.list_village_membership_requests(uuid),
  public.request_village_membership(uuid), public.invite_family_to_village(uuid, uuid),
  public.respond_village_invitation(uuid, boolean), public.respond_village_join_request(uuid, uuid, boolean),
  public.set_village_member_role(uuid, uuid, text), public.leave_village(uuid), public.remove_village_member(uuid, uuid),
  public.list_village_messages(uuid, timestamptz, integer), public.send_village_message(uuid, text, uuid),
  public.set_village_conversation_muted(uuid, boolean), public.submit_village_report(uuid, uuid, text, text),
  public.list_village_reports(uuid), public.resolve_village_report(uuid, text)
  to authenticated;

insert into kinavela_private.schema_migrations(version)
values ('202608090012_villages') on conflict(version) do nothing;

notify pgrst, 'reload schema';
commit;
