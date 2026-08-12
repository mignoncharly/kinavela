begin;

create table public.family_connections (
  id uuid primary key default gen_random_uuid(),
  requester_family_id uuid not null references public.families(id) on delete cascade,
  recipient_family_id uuid not null references public.families(id) on delete cascade,
  status text not null default 'requested' check (status in ('requested', 'accepted', 'declined', 'blocked')),
  status_changed_by_family_id uuid not null references public.families(id) on delete cascade,
  requested_at timestamptz not null default now(),
  responded_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_family_id <> recipient_family_id),
  check (status_changed_by_family_id in (requester_family_id, recipient_family_id)),
  check ((status = 'accepted' and accepted_at is not null) or (status <> 'accepted' and accepted_at is null)),
  check ((status = 'requested' and responded_at is null) or status <> 'requested')
);

create unique index family_connections_pair_unique
  on public.family_connections(
    least(requester_family_id, recipient_family_id),
    greatest(requester_family_id, recipient_family_id)
  );
create index family_connections_requester_status_idx
  on public.family_connections(requester_family_id, status, updated_at desc);
create index family_connections_recipient_status_idx
  on public.family_connections(recipient_family_id, status, updated_at desc);

create table public.connection_request_attempts (
  id bigint generated always as identity primary key,
  family_id uuid not null references public.families(id) on delete cascade,
  attempted_at timestamptz not null default now()
);

create index connection_request_attempts_family_time_idx
  on public.connection_request_attempts(family_id, attempted_at desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_profile_id uuid not null references public.profiles(id) on delete cascade,
  notification_type text not null check (notification_type in ('connection_request', 'connection_accepted')),
  actor_family_id uuid not null references public.families(id) on delete cascade,
  connection_id uuid not null references public.family_connections(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique(recipient_profile_id, notification_type, connection_id)
);

create index notifications_recipient_unread_idx
  on public.notifications(recipient_profile_id, created_at desc)
  where read_at is null;

alter table public.family_connections enable row level security;
alter table public.family_connections force row level security;
alter table public.connection_request_attempts enable row level security;
alter table public.connection_request_attempts force row level security;
alter table public.notifications enable row level security;
alter table public.notifications force row level security;

create policy "Families read their connections"
  on public.family_connections for select to authenticated
  using (
    public.is_family_member(requester_family_id)
    or public.is_family_member(recipient_family_id)
  );

create policy "Profiles read own notifications"
  on public.notifications for select to authenticated
  using (recipient_profile_id = public.current_profile_id());

revoke all on public.family_connections, public.connection_request_attempts,
  public.notifications from public, anon, authenticated;
grant select on public.family_connections, public.notifications to authenticated;

create trigger family_connections_set_updated_at
  before update on public.family_connections
  for each row execute function public.set_updated_at();

create or replace function kinavela_private.current_family_id(p_owner_required boolean default false)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select fm.family_id
  from public.family_members fm
  join public.profiles p on p.id = fm.profile_id
  where p.auth_user_id = auth.uid()
    and p.status = 'active'
    and fm.status = 'active'
    and (not p_owner_required or fm.role = 'owner')
  order by fm.created_at
  limit 1
$$;

create or replace function kinavela_private.families_are_connected(
  p_first_family_id uuid,
  p_second_family_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.family_connections fc
    where least(fc.requester_family_id, fc.recipient_family_id) = least(p_first_family_id, p_second_family_id)
      and greatest(fc.requester_family_id, fc.recipient_family_id) = greatest(p_first_family_id, p_second_family_id)
      and fc.status = 'accepted'
      and not exists (
        select 1 from public.discovery_blocks db
        where (db.blocker_family_id = p_first_family_id and db.blocked_family_id = p_second_family_id)
           or (db.blocker_family_id = p_second_family_id and db.blocked_family_id = p_first_family_id)
      )
  )
$$;

create or replace function kinavela_private.can_request_family_connection(
  p_requester_family_id uuid,
  p_target_family_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.families requester
    cross join public.families target
    where requester.id = p_requester_family_id
      and target.id = p_target_family_id
      and requester.id <> target.id
      and requester.visibility = 'discoverable'
      and target.visibility = 'discoverable'
      and requester.location is not null
      and target.location is not null
      and extensions.st_dwithin(
        requester.location,
        target.location,
        least(requester.discovery_radius_km, target.discovery_radius_km) * 1000.0
      )
      and not exists (
        select 1 from public.discovery_blocks db
        where (db.blocker_family_id = requester.id and db.blocked_family_id = target.id)
           or (db.blocker_family_id = target.id and db.blocked_family_id = requester.id)
      )
  )
$$;

revoke all on function kinavela_private.current_family_id(boolean),
  kinavela_private.families_are_connected(uuid, uuid),
  kinavela_private.can_request_family_connection(uuid, uuid)
  from public, anon, authenticated, service_role;

create or replace function public.request_family_connection(p_target_family_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_uuid uuid := public.current_profile_id();
  family_uuid uuid := kinavela_private.current_family_id(true);
  connection public.family_connections%rowtype;
  recent_attempts integer;
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  if family_uuid is null then raise exception 'not_authorized'; end if;
  if not kinavela_private.can_request_family_connection(family_uuid, p_target_family_id) then
    raise exception 'family_not_available';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    least(family_uuid, p_target_family_id)::text || ':' || greatest(family_uuid, p_target_family_id)::text,
    0
  ));

  delete from public.connection_request_attempts
  where family_id = family_uuid and attempted_at < now() - interval '24 hours';
  select count(*) into recent_attempts
  from public.connection_request_attempts
  where family_id = family_uuid and attempted_at >= now() - interval '24 hours';
  if recent_attempts >= 10 then raise exception 'connection_rate_limited'; end if;
  insert into public.connection_request_attempts(family_id) values (family_uuid);

  select * into connection
  from public.family_connections fc
  where least(fc.requester_family_id, fc.recipient_family_id) = least(family_uuid, p_target_family_id)
    and greatest(fc.requester_family_id, fc.recipient_family_id) = greatest(family_uuid, p_target_family_id)
  for update;

  if connection.id is not null then
    if connection.status in ('requested', 'accepted') then return connection.id; end if;
    if connection.status = 'blocked' then raise exception 'family_not_available'; end if;
    if connection.responded_at > now() - interval '30 days' then
      raise exception 'connection_cooldown';
    end if;
    update public.family_connections
    set requester_family_id = family_uuid,
        recipient_family_id = p_target_family_id,
        status = 'requested',
        status_changed_by_family_id = family_uuid,
        requested_at = now(), responded_at = null, accepted_at = null
    where id = connection.id
    returning * into connection;
  else
    insert into public.family_connections(
      requester_family_id, recipient_family_id, status_changed_by_family_id
    ) values (family_uuid, p_target_family_id, family_uuid)
    returning * into connection;
  end if;

  delete from public.notifications where connection_id = connection.id;
  insert into public.notifications(
    recipient_profile_id, notification_type, actor_family_id, connection_id
  )
  select fm.profile_id, 'connection_request', family_uuid, connection.id
  from public.family_members fm
  join public.profiles p on p.id = fm.profile_id and p.status = 'active'
  where fm.family_id = p_target_family_id and fm.status = 'active';

  insert into public.audit_events(actor_profile_id, event_type, entity_type, entity_id)
  values (profile_uuid, 'connection_requested', 'family_connection', connection.id);
  return connection.id;
end;
$$;

create or replace function public.respond_family_connection(
  p_connection_id uuid,
  p_accept boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_uuid uuid := public.current_profile_id();
  family_uuid uuid := kinavela_private.current_family_id(true);
  connection public.family_connections%rowtype;
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  if family_uuid is null then raise exception 'not_authorized'; end if;

  select * into connection from public.family_connections
  where id = p_connection_id for update;
  if connection.id is null or connection.recipient_family_id <> family_uuid
     or connection.status <> 'requested' then raise exception 'connection_not_pending'; end if;
  if exists (
    select 1 from public.discovery_blocks db
    where (db.blocker_family_id = connection.requester_family_id and db.blocked_family_id = connection.recipient_family_id)
       or (db.blocker_family_id = connection.recipient_family_id and db.blocked_family_id = connection.requester_family_id)
  ) then raise exception 'family_not_available'; end if;

  update public.family_connections
  set status = case when p_accept then 'accepted' else 'declined' end,
      status_changed_by_family_id = family_uuid,
      responded_at = now(),
      accepted_at = case when p_accept then now() else null end
  where id = connection.id;

  delete from public.notifications
  where connection_id = connection.id and notification_type = 'connection_request';

  if p_accept then
    insert into public.notifications(
      recipient_profile_id, notification_type, actor_family_id, connection_id
    )
    select fm.profile_id, 'connection_accepted', family_uuid, connection.id
    from public.family_members fm
    join public.profiles p on p.id = fm.profile_id and p.status = 'active'
    where fm.family_id = connection.requester_family_id and fm.status = 'active'
    on conflict do nothing;
  end if;

  insert into public.audit_events(actor_profile_id, event_type, entity_type, entity_id)
  values (
    profile_uuid,
    case when p_accept then 'connection_accepted' else 'connection_declined' end,
    'family_connection', connection.id
  );
  return true;
end;
$$;

create or replace function public.list_family_connections()
returns table (
  connection_id uuid,
  other_family_id uuid,
  family_name text,
  display_city text,
  country_code text,
  status text,
  direction text,
  requested_at timestamptz,
  accepted_at timestamptz,
  bio text,
  guardian_names text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  profile_uuid uuid := public.current_profile_id();
  family_uuid uuid := kinavela_private.current_family_id(false);
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  if family_uuid is null then raise exception 'family_not_found'; end if;

  return query
  select fc.id,
    other_family.id,
    other_family.name,
    other_family.city,
    other_family.country_of_residence,
    fc.status,
    case when fc.requester_family_id = family_uuid then 'outgoing' else 'incoming' end,
    fc.requested_at,
    fc.accepted_at,
    case when fc.status = 'accepted' then other_family.bio else null end,
    case when fc.status = 'accepted' then coalesce((
      select array_agg(p.display_name order by p.display_name)
      from public.family_members fm
      join public.profiles p on p.id = fm.profile_id
      where fm.family_id = other_family.id
        and fm.status = 'active'
        and fm.role in ('owner', 'guardian')
        and p.status = 'active'
    ), '{}'::text[]) else '{}'::text[] end
  from public.family_connections fc
  join public.families other_family on other_family.id = case
    when fc.requester_family_id = family_uuid then fc.recipient_family_id
    else fc.requester_family_id
  end
  where family_uuid in (fc.requester_family_id, fc.recipient_family_id)
    and fc.status in ('requested', 'accepted')
  order by case when fc.status = 'requested' and fc.recipient_family_id = family_uuid then 0
                when fc.status = 'accepted' then 1 else 2 end,
           fc.updated_at desc;
end;
$$;

create or replace function public.list_notifications(p_limit integer default 30)
returns table (
  notification_id uuid,
  notification_type text,
  actor_family_id uuid,
  actor_family_name text,
  connection_id uuid,
  read_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  profile_uuid uuid := public.current_profile_id();
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  if p_limit not between 1 and 50 then raise exception 'invalid_limit'; end if;
  return query
  select n.id, n.notification_type, n.actor_family_id, f.name,
    n.connection_id, n.read_at, n.created_at
  from public.notifications n
  join public.families f on f.id = n.actor_family_id
  where n.recipient_profile_id = profile_uuid
  order by n.created_at desc
  limit p_limit;
end;
$$;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_uuid uuid := public.current_profile_id();
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  update public.notifications
  set read_at = coalesce(read_at, now())
  where id = p_notification_id and recipient_profile_id = profile_uuid;
  if not found then raise exception 'notification_not_found'; end if;
  return true;
end;
$$;

create or replace function public.are_families_connected(p_other_family_id uuid)
returns boolean
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
  return kinavela_private.families_are_connected(family_uuid, p_other_family_id);
end;
$$;

create or replace function public.set_discovery_block(
  p_target_family_id uuid,
  p_blocked boolean default true
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_uuid uuid := public.current_profile_id();
  family_uuid uuid := kinavela_private.current_family_id(true);
  connection public.family_connections%rowtype;
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  if family_uuid is null or family_uuid = p_target_family_id then raise exception 'not_authorized'; end if;
  if not exists (select 1 from public.families where id = p_target_family_id) then
    raise exception 'family_not_found';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    least(family_uuid, p_target_family_id)::text || ':' || greatest(family_uuid, p_target_family_id)::text,
    0
  ));
  select * into connection from public.family_connections fc
  where least(fc.requester_family_id, fc.recipient_family_id) = least(family_uuid, p_target_family_id)
    and greatest(fc.requester_family_id, fc.recipient_family_id) = greatest(family_uuid, p_target_family_id)
  for update;

  if p_blocked then
    insert into public.discovery_blocks(blocker_family_id, blocked_family_id, created_by)
    values (family_uuid, p_target_family_id, profile_uuid)
    on conflict(blocker_family_id, blocked_family_id) do nothing;
    if connection.id is null then
      insert into public.family_connections(
        requester_family_id, recipient_family_id, status, status_changed_by_family_id,
        responded_at
      ) values (family_uuid, p_target_family_id, 'blocked', family_uuid, now())
      returning * into connection;
    else
      update public.family_connections
      set status = 'blocked', status_changed_by_family_id = family_uuid,
          responded_at = now(), accepted_at = null
      where id = connection.id returning * into connection;
    end if;
    delete from public.notifications where connection_id = connection.id;
    insert into public.audit_events(actor_profile_id, event_type, entity_type, entity_id)
    values (profile_uuid, 'family_blocked', 'family', p_target_family_id);
  else
    delete from public.discovery_blocks
    where blocker_family_id = family_uuid and blocked_family_id = p_target_family_id;
    if connection.id is not null and connection.status = 'blocked'
       and not exists (
         select 1 from public.discovery_blocks db
         where (db.blocker_family_id = family_uuid and db.blocked_family_id = p_target_family_id)
            or (db.blocker_family_id = p_target_family_id and db.blocked_family_id = family_uuid)
       ) then
      update public.family_connections
      set status = 'declined', status_changed_by_family_id = family_uuid,
          responded_at = now(), accepted_at = null
      where id = connection.id;
    end if;
    insert into public.audit_events(actor_profile_id, event_type, entity_type, entity_id)
    values (profile_uuid, 'family_unblocked', 'family', p_target_family_id);
  end if;
  return true;
end;
$$;

revoke all on function public.request_family_connection(uuid),
  public.respond_family_connection(uuid, boolean),
  public.list_family_connections(), public.list_notifications(integer),
  public.mark_notification_read(uuid), public.are_families_connected(uuid),
  public.set_discovery_block(uuid, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.request_family_connection(uuid),
  public.respond_family_connection(uuid, boolean),
  public.list_family_connections(), public.list_notifications(integer),
  public.mark_notification_read(uuid), public.are_families_connected(uuid),
  public.set_discovery_block(uuid, boolean)
  to authenticated;

insert into kinavela_private.schema_migrations(version)
values ('202608090008_family_connections')
on conflict (version) do nothing;

notify pgrst, 'reload schema';

commit;
