begin;

create table public.events (
  id uuid primary key default gen_random_uuid(),
  village_id uuid not null references public.villages(id) on delete cascade,
  creator_family_id uuid not null references public.families(id) on delete restrict,
  creator_profile_id uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 3 and 120),
  description text not null check (char_length(btrim(description)) between 10 and 2000),
  category text not null check (category in (
    'playdate', 'park', 'picnic', 'cooking', 'language', 'cultural',
    'sports', 'creative', 'family_support', 'celebration', 'other'
  )),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location_name text not null check (char_length(btrim(location_name)) between 2 and 120),
  location_city text not null check (char_length(btrim(location_city)) between 2 and 120),
  public_location_description text not null
    check (char_length(btrim(public_location_description)) between 2 and 240),
  address_visibility text not null default 'going'
    check (address_visibility in ('going', 'all_members')),
  max_families integer check (max_families is null or max_families between 1 and 100),
  registration_deadline timestamptz not null,
  visibility text not null default 'village' check (visibility = 'village'),
  status text not null default 'scheduled'
    check (status in ('scheduled', 'cancelled', 'completed')),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (registration_deadline <= starts_at),
  check ((status = 'cancelled' and cancelled_at is not null) or
         (status <> 'cancelled' and cancelled_at is null))
);

create index events_village_start_idx on public.events(village_id, starts_at, status);
create index events_creator_time_idx on public.events(creator_family_id, created_at desc);

create table kinavela_private.event_locations (
  event_id uuid primary key references public.events(id) on delete cascade,
  location_address text not null check (char_length(btrim(location_address)) between 5 and 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.event_attendees (
  event_id uuid not null references public.events(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  status text not null check (status in ('going', 'maybe', 'declined', 'waitlisted')),
  number_of_adults integer not null default 1 check (number_of_adults between 0 and 10),
  number_of_children integer not null default 0 check (number_of_children between 0 and 20),
  attendance_confirmed_at timestamptz,
  attendance_confirmed_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(event_id, family_id),
  check (number_of_adults + number_of_children between 1 and 30),
  check ((attendance_confirmed_at is null and attendance_confirmed_by_profile_id is null) or
         (attendance_confirmed_at is not null and attendance_confirmed_by_profile_id is not null))
);

create index event_attendees_event_status_idx
  on public.event_attendees(event_id, status, created_at);
create index event_attendees_family_time_idx
  on public.event_attendees(family_id, updated_at desc);

create table public.event_reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  recipient_profile_id uuid not null references public.profiles(id) on delete cascade,
  reminder_kind text not null check (reminder_kind in (
    'scheduled_24h', 'organizer', 'event_updated', 'event_cancelled', 'waitlist_promoted'
  )),
  due_at timestamptz not null,
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique(event_id, recipient_profile_id, reminder_kind),
  check (read_at is null or delivered_at is not null)
);

create index event_reminders_due_idx
  on public.event_reminder_deliveries(due_at)
  where delivered_at is null;
create index event_reminders_recipient_idx
  on public.event_reminder_deliveries(recipient_profile_id, delivered_at desc)
  where delivered_at is not null and read_at is null;

create trigger events_set_updated_at before update on public.events
  for each row execute function public.set_updated_at();
create trigger event_attendees_set_updated_at before update on public.event_attendees
  for each row execute function public.set_updated_at();
create trigger event_locations_set_updated_at before update on kinavela_private.event_locations
  for each row execute function public.set_updated_at();

alter table public.events enable row level security;
alter table public.events force row level security;
alter table public.event_attendees enable row level security;
alter table public.event_attendees force row level security;
alter table public.event_reminder_deliveries enable row level security;
alter table public.event_reminder_deliveries force row level security;

create or replace function kinavela_private.can_manage_village_events(p_village_id uuid)
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
      and vm.role in ('owner', 'organizer')
      and v.status = 'active'
  )
$$;

create or replace function kinavela_private.can_view_event_address(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.events e
    where e.id = p_event_id
      and kinavela_private.can_access_village(e.village_id, false)
      and (
        kinavela_private.can_manage_village_events(e.village_id)
        or e.address_visibility = 'all_members'
        or exists (
          select 1 from public.event_attendees ea
          where ea.event_id = e.id
            and ea.family_id = kinavela_private.current_family_id(false)
            and ea.status = 'going'
        )
      )
  )
$$;

create or replace function public.can_view_event_address(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select kinavela_private.can_view_event_address(p_event_id) $$;

revoke all on function kinavela_private.can_manage_village_events(uuid),
  kinavela_private.can_view_event_address(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.can_view_event_address(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.can_view_event_address(uuid) to authenticated;

create policy "Village members read events" on public.events for select to authenticated
  using (public.can_access_village(village_id));
create policy "Village members read event attendance" on public.event_attendees for select to authenticated
  using (exists (
    select 1 from public.events e
    where e.id = event_id and public.can_access_village(e.village_id)
  ));
create policy "Profiles read delivered event reminders" on public.event_reminder_deliveries
  for select to authenticated
  using (recipient_profile_id = public.current_profile_id() and delivered_at is not null);

revoke all on public.events, public.event_attendees, public.event_reminder_deliveries
  from public, anon, authenticated;
revoke all on kinavela_private.event_locations from public, anon, authenticated, service_role;

create or replace function kinavela_private.queue_event_delivery(
  p_event_id uuid,
  p_family_id uuid,
  p_kind text,
  p_due_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.event_reminder_deliveries(
    event_id, recipient_profile_id, reminder_kind, due_at,
    delivered_at, read_at
  )
  select p_event_id, fm.profile_id, p_kind, p_due_at,
    case when p_due_at <= now() then now() else null end, null
  from public.family_members fm
  join public.profiles p on p.id = fm.profile_id and p.status = 'active'
  where fm.family_id = p_family_id and fm.status = 'active'
  on conflict(event_id, recipient_profile_id, reminder_kind) do update
  set due_at = excluded.due_at,
      delivered_at = excluded.delivered_at,
      read_at = null,
      created_at = now();
end;
$$;

create or replace function kinavela_private.promote_event_waitlist(p_event_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.events%rowtype;
  promoted_family_id uuid;
begin
  select * into event_row from public.events where id = p_event_id for update;
  if event_row.id is null or event_row.status <> 'scheduled' or event_row.max_families is null then
    return null;
  end if;
  if (select count(*) from public.event_attendees where event_id = p_event_id and status = 'going')
     >= event_row.max_families then
    return null;
  end if;
  select family_id into promoted_family_id
  from public.event_attendees
  where event_id = p_event_id and status = 'waitlisted'
  order by created_at, family_id
  for update skip locked
  limit 1;
  if promoted_family_id is null then return null; end if;
  update public.event_attendees
  set status = 'going', updated_at = now()
  where event_id = p_event_id and family_id = promoted_family_id;
  perform kinavela_private.queue_event_delivery(
    p_event_id, promoted_family_id, 'waitlist_promoted', now()
  );
  perform kinavela_private.queue_event_delivery(
    p_event_id, promoted_family_id, 'scheduled_24h',
    greatest(now(), event_row.starts_at - interval '24 hours')
  );
  return promoted_family_id;
end;
$$;

revoke all on function kinavela_private.queue_event_delivery(uuid, uuid, text, timestamptz),
  kinavela_private.promote_event_waitlist(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.create_village_event(
  p_village_id uuid,
  p_title text,
  p_description text,
  p_category text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_location_name text,
  p_location_city text,
  p_location_address text,
  p_public_location_description text,
  p_address_visibility text default 'going',
  p_max_families integer default null,
  p_registration_deadline timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_uuid uuid := public.current_profile_id();
  family_uuid uuid := kinavela_private.current_family_id(false);
  event_uuid uuid := gen_random_uuid();
  deadline timestamptz := coalesce(p_registration_deadline, p_starts_at);
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  if family_uuid is null or not kinavela_private.can_manage_village_events(p_village_id) then
    raise exception 'not_authorized';
  end if;
  if p_starts_at <= now() or p_ends_at <= p_starts_at or deadline > p_starts_at then
    raise exception 'invalid_event_time';
  end if;
  if p_category not in ('playdate', 'park', 'picnic', 'cooking', 'language', 'cultural',
    'sports', 'creative', 'family_support', 'celebration', 'other')
    or p_address_visibility not in ('going', 'all_members')
    or p_max_families is not null and p_max_families not between 1 and 100 then
    raise exception 'invalid_event';
  end if;
  if (select count(*) from public.events
      where creator_family_id = family_uuid and created_at >= now() - interval '24 hours') >= 10 then
    raise exception 'event_create_rate_limited';
  end if;
  insert into public.events(
    id, village_id, creator_family_id, creator_profile_id, title, description,
    category, starts_at, ends_at, location_name, location_city,
    public_location_description, address_visibility, max_families, registration_deadline
  ) values (
    event_uuid, p_village_id, family_uuid, profile_uuid, btrim(p_title), btrim(p_description),
    p_category, p_starts_at, p_ends_at, btrim(p_location_name), btrim(p_location_city),
    btrim(p_public_location_description), p_address_visibility, p_max_families, deadline
  );
  insert into kinavela_private.event_locations(event_id, location_address)
  values (event_uuid, btrim(p_location_address));
  insert into public.audit_events(actor_profile_id, event_type, entity_type, entity_id)
  values (profile_uuid, 'event_created', 'event', event_uuid);
  return event_uuid;
end;
$$;

create or replace function public.update_village_event(
  p_event_id uuid,
  p_title text,
  p_description text,
  p_category text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_location_name text,
  p_location_city text,
  p_location_address text,
  p_public_location_description text,
  p_address_visibility text,
  p_max_families integer,
  p_registration_deadline timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_uuid uuid := public.current_profile_id();
  event_row public.events%rowtype;
  attendee record;
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  select * into event_row from public.events where id = p_event_id for update;
  if event_row.id is null or event_row.status <> 'scheduled' then raise exception 'event_not_available'; end if;
  if not kinavela_private.can_manage_village_events(event_row.village_id) then raise exception 'not_authorized'; end if;
  if event_row.starts_at <= now() or p_starts_at <= now() or p_ends_at <= p_starts_at
     or p_registration_deadline > p_starts_at then raise exception 'invalid_event_time'; end if;
  if p_max_families is not null and p_max_families <
     (select count(*) from public.event_attendees where event_id = p_event_id and status = 'going') then
    raise exception 'capacity_below_rsvp_count';
  end if;
  update public.events set
    title = btrim(p_title), description = btrim(p_description), category = p_category,
    starts_at = p_starts_at, ends_at = p_ends_at, location_name = btrim(p_location_name),
    location_city = btrim(p_location_city),
    public_location_description = btrim(p_public_location_description),
    address_visibility = p_address_visibility, max_families = p_max_families,
    registration_deadline = p_registration_deadline
  where id = p_event_id;
  update kinavela_private.event_locations
  set location_address = btrim(p_location_address)
  where event_id = p_event_id;
  for attendee in
    select family_id from public.event_attendees
    where event_id = p_event_id and status in ('going', 'maybe', 'waitlisted')
  loop
    perform kinavela_private.queue_event_delivery(p_event_id, attendee.family_id, 'event_updated', now());
    if attendee.family_id in (
      select family_id from public.event_attendees where event_id = p_event_id and status = 'going'
    ) then
      perform kinavela_private.queue_event_delivery(
        p_event_id, attendee.family_id, 'scheduled_24h',
        greatest(now(), p_starts_at - interval '24 hours')
      );
    end if;
  end loop;
  insert into public.audit_events(actor_profile_id, event_type, entity_type, entity_id)
  values (profile_uuid, 'event_updated', 'event', p_event_id);
  return true;
end;
$$;

create or replace function public.cancel_village_event(p_event_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_uuid uuid := public.current_profile_id();
  event_row public.events%rowtype;
  attendee record;
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  select * into event_row from public.events where id = p_event_id for update;
  if event_row.id is null or event_row.status <> 'scheduled' then raise exception 'event_not_available'; end if;
  if not kinavela_private.can_manage_village_events(event_row.village_id) then raise exception 'not_authorized'; end if;
  update public.events set status = 'cancelled', cancelled_at = now() where id = p_event_id;
  delete from public.event_reminder_deliveries
  where event_id = p_event_id and reminder_kind = 'scheduled_24h';
  for attendee in
    select family_id from public.event_attendees
    where event_id = p_event_id and status in ('going', 'maybe', 'waitlisted')
  loop
    perform kinavela_private.queue_event_delivery(p_event_id, attendee.family_id, 'event_cancelled', now());
  end loop;
  insert into public.audit_events(actor_profile_id, event_type, entity_type, entity_id)
  values (profile_uuid, 'event_cancelled', 'event', p_event_id);
  return true;
end;
$$;

create or replace function public.rsvp_village_event(
  p_event_id uuid,
  p_status text,
  p_number_of_adults integer default 1,
  p_number_of_children integer default 0
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_uuid uuid := public.current_profile_id();
  family_uuid uuid := kinavela_private.current_family_id(true);
  event_row public.events%rowtype;
  previous_status text;
  effective_status text := p_status;
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  if family_uuid is null then raise exception 'not_authorized'; end if;
  select * into event_row from public.events where id = p_event_id for update;
  if event_row.id is null or event_row.status <> 'scheduled'
     or not kinavela_private.is_village_family_member(event_row.village_id, family_uuid, false) then
    raise exception 'event_not_available';
  end if;
  if now() > event_row.registration_deadline then raise exception 'registration_closed'; end if;
  if p_status not in ('going', 'maybe', 'declined')
     or p_number_of_adults not between 0 and 10
     or p_number_of_children not between 0 and 20
     or p_number_of_adults + p_number_of_children not between 1 and 30 then
    raise exception 'invalid_rsvp';
  end if;
  select status into previous_status from public.event_attendees
  where event_id = p_event_id and family_id = family_uuid for update;
  if p_status = 'going' and event_row.max_families is not null
     and coalesce(previous_status, '') <> 'going'
     and (select count(*) from public.event_attendees where event_id = p_event_id and status = 'going')
         >= event_row.max_families then
    effective_status := 'waitlisted';
  end if;
  insert into public.event_attendees(
    event_id, family_id, status, number_of_adults, number_of_children
  ) values (
    p_event_id, family_uuid, effective_status, p_number_of_adults, p_number_of_children
  ) on conflict(event_id, family_id) do update set
    status = excluded.status,
    number_of_adults = excluded.number_of_adults,
    number_of_children = excluded.number_of_children,
    attendance_confirmed_at = null,
    attendance_confirmed_by_profile_id = null,
    updated_at = now();
  if effective_status = 'going' then
    perform kinavela_private.queue_event_delivery(
      p_event_id, family_uuid, 'scheduled_24h',
      greatest(now(), event_row.starts_at - interval '24 hours')
    );
  else
    delete from public.event_reminder_deliveries
    where event_id = p_event_id and recipient_profile_id in (
      select profile_id from public.family_members where family_id = family_uuid
    ) and reminder_kind = 'scheduled_24h';
  end if;
  if previous_status = 'going' and effective_status <> 'going' then
    perform kinavela_private.promote_event_waitlist(p_event_id);
  end if;
  insert into public.audit_events(actor_profile_id, event_type, entity_type, entity_id,
    metadata)
  values (profile_uuid, 'event_rsvp', 'event', p_event_id,
    jsonb_build_object('status', effective_status));
  return effective_status;
end;
$$;

create or replace function public.confirm_event_attendance(
  p_event_id uuid,
  p_family_id uuid,
  p_attended boolean default true
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_uuid uuid := public.current_profile_id();
  event_row public.events%rowtype;
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  select * into event_row from public.events where id = p_event_id for update;
  if event_row.id is null or event_row.status = 'cancelled' then raise exception 'event_not_available'; end if;
  if not kinavela_private.can_manage_village_events(event_row.village_id) then raise exception 'not_authorized'; end if;
  if now() < event_row.starts_at - interval '2 hours' then raise exception 'attendance_too_early'; end if;
  update public.event_attendees set
    attendance_confirmed_at = case when p_attended then now() else null end,
    attendance_confirmed_by_profile_id = case when p_attended then profile_uuid else null end
  where event_id = p_event_id and family_id = p_family_id and status = 'going';
  if not found then raise exception 'attendee_not_available'; end if;
  insert into public.audit_events(actor_profile_id, event_type, entity_type, entity_id,
    metadata)
  values (profile_uuid, case when p_attended then 'event_attended' else 'event_attendance_removed' end,
    'event', p_event_id, jsonb_build_object('family_id', p_family_id));
  return true;
end;
$$;

create or replace function public.send_event_reminder(p_event_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_uuid uuid := public.current_profile_id();
  event_row public.events%rowtype;
  attendee record;
  recipient_count integer := 0;
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  select * into event_row from public.events where id = p_event_id for update;
  if event_row.id is null or event_row.status <> 'scheduled' then raise exception 'event_not_available'; end if;
  if not kinavela_private.can_manage_village_events(event_row.village_id) then raise exception 'not_authorized'; end if;
  if exists (select 1 from public.audit_events
    where actor_profile_id = profile_uuid and event_type = 'event_reminder_sent'
      and entity_id = p_event_id and created_at >= now() - interval '1 hour') then
    raise exception 'reminder_rate_limited';
  end if;
  for attendee in
    select family_id from public.event_attendees
    where event_id = p_event_id and status in ('going', 'maybe', 'waitlisted')
  loop
    perform kinavela_private.queue_event_delivery(p_event_id, attendee.family_id, 'organizer', now());
    recipient_count := recipient_count + 1;
  end loop;
  insert into public.audit_events(actor_profile_id, event_type, entity_type, entity_id,
    metadata)
  values (profile_uuid, 'event_reminder_sent', 'event', p_event_id,
    jsonb_build_object('recipient_families', recipient_count));
  return recipient_count;
end;
$$;

create or replace function public.dispatch_due_event_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare delivered_count integer;
begin
  update public.event_reminder_deliveries erd
  set delivered_at = now()
  from public.events e
  where e.id = erd.event_id
    and e.status = 'scheduled'
    and erd.delivered_at is null
    and erd.due_at <= now()
    and exists (
      select 1 from public.family_members fm
      join public.event_attendees ea on ea.family_id = fm.family_id
      where fm.profile_id = erd.recipient_profile_id
        and fm.status = 'active'
        and ea.event_id = erd.event_id
        and ea.status = 'going'
    );
  get diagnostics delivered_count = row_count;
  return delivered_count;
end;
$$;

create or replace function public.mark_event_reminder_read(p_event_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare profile_uuid uuid := public.current_profile_id();
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  update public.event_reminder_deliveries set read_at = coalesce(read_at, now())
  where event_id = p_event_id and recipient_profile_id = profile_uuid
    and delivered_at is not null;
  return found;
end;
$$;

create or replace function public.list_village_events(p_village_id uuid)
returns table (
  event_id uuid, village_id uuid, title text, description text, category text,
  starts_at timestamptz, ends_at timestamptz, location_name text, location_city text,
  public_location_description text, location_address text, address_visible boolean,
  address_visibility text, max_families integer, registration_deadline timestamptz,
  status text, creator_family_name text, current_rsvp_status text,
  number_of_adults integer, number_of_children integer,
  going_count integer, maybe_count integer, waitlist_count integer, attended_count integer,
  can_manage boolean, reminder_unread boolean, latest_reminder_kind text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  family_uuid uuid := kinavela_private.current_family_id(false);
  profile_uuid uuid := public.current_profile_id();
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  if not kinavela_private.can_access_village(p_village_id, false) then
    raise exception 'village_not_available';
  end if;
  return query
  select e.id, e.village_id, e.title, e.description, e.category,
    e.starts_at, e.ends_at, e.location_name, e.location_city,
    e.public_location_description,
    case when kinavela_private.can_view_event_address(e.id) then el.location_address else null end,
    kinavela_private.can_view_event_address(e.id), e.address_visibility,
    e.max_families, e.registration_deadline, e.status, creator.name,
    ea.status, ea.number_of_adults, ea.number_of_children,
    (select count(*)::integer from public.event_attendees x where x.event_id = e.id and x.status = 'going'),
    (select count(*)::integer from public.event_attendees x where x.event_id = e.id and x.status = 'maybe'),
    (select count(*)::integer from public.event_attendees x where x.event_id = e.id and x.status = 'waitlisted'),
    (select count(*)::integer from public.event_attendees x where x.event_id = e.id and x.attendance_confirmed_at is not null),
    kinavela_private.can_manage_village_events(e.village_id),
    exists (select 1 from public.event_reminder_deliveries er
      where er.event_id = e.id and er.recipient_profile_id = profile_uuid
        and er.delivered_at is not null and er.read_at is null),
    (select er.reminder_kind from public.event_reminder_deliveries er
      where er.event_id = e.id and er.recipient_profile_id = profile_uuid
        and er.delivered_at is not null
      order by er.delivered_at desc limit 1)
  from public.events e
  join public.families creator on creator.id = e.creator_family_id
  join kinavela_private.event_locations el on el.event_id = e.id
  left join public.event_attendees ea on ea.event_id = e.id and ea.family_id = family_uuid
  where e.village_id = p_village_id
  order by (e.status = 'scheduled') desc, e.starts_at asc, e.id;
end;
$$;

create or replace function public.list_event_attendees(p_event_id uuid)
returns table (
  family_id uuid, family_name text, status text,
  number_of_adults integer, number_of_children integer,
  attendance_confirmed boolean, rsvp_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare event_village_id uuid;
begin
  select village_id into event_village_id from public.events where id = p_event_id;
  if event_village_id is null or not kinavela_private.can_access_village(event_village_id, false) then
    raise exception 'event_not_available';
  end if;
  return query select ea.family_id, f.name, ea.status,
    ea.number_of_adults, ea.number_of_children,
    ea.attendance_confirmed_at is not null, ea.created_at
  from public.event_attendees ea
  join public.families f on f.id = ea.family_id
  where ea.event_id = p_event_id and ea.status <> 'declined'
  order by case ea.status when 'going' then 0 when 'maybe' then 1 else 2 end,
    ea.created_at, ea.family_id;
end;
$$;

revoke all on function public.create_village_event(uuid,text,text,text,timestamptz,timestamptz,text,text,text,text,text,integer,timestamptz),
  public.update_village_event(uuid,text,text,text,timestamptz,timestamptz,text,text,text,text,text,integer,timestamptz),
  public.cancel_village_event(uuid), public.rsvp_village_event(uuid,text,integer,integer),
  public.confirm_event_attendance(uuid,uuid,boolean), public.send_event_reminder(uuid),
  public.dispatch_due_event_reminders(), public.mark_event_reminder_read(uuid),
  public.list_village_events(uuid), public.list_event_attendees(uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.create_village_event(uuid,text,text,text,timestamptz,timestamptz,text,text,text,text,text,integer,timestamptz),
  public.update_village_event(uuid,text,text,text,timestamptz,timestamptz,text,text,text,text,text,integer,timestamptz),
  public.cancel_village_event(uuid), public.rsvp_village_event(uuid,text,integer,integer),
  public.confirm_event_attendance(uuid,uuid,boolean), public.send_event_reminder(uuid),
  public.mark_event_reminder_read(uuid), public.list_village_events(uuid),
  public.list_event_attendees(uuid)
  to authenticated;
grant execute on function public.dispatch_due_event_reminders() to service_role;

insert into kinavela_private.schema_migrations(version)
values ('202608100001_village_events');

commit;
