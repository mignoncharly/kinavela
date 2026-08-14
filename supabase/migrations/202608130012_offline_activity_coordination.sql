begin;

create table public.playdates (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.family_connections(id) on delete cascade,
  proposer_family_id uuid not null references public.families(id) on delete cascade,
  recipient_family_id uuid not null references public.families(id) on delete cascade,
  proposer_profile_id uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 3 and 120),
  approximate_location text not null check (char_length(btrim(approximate_location)) between 2 and 240),
  proposer_adults integer not null check (proposer_adults between 0 and 10),
  proposer_children integer not null check (proposer_children between 0 and 20),
  recipient_adults integer check (recipient_adults between 0 and 10),
  recipient_children integer check (recipient_children between 0 and 20),
  selected_option_id uuid,
  status text not null default 'proposed' check (
    status in ('proposed', 'accepted', 'declined', 'cancelled')
  ),
  responded_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (proposer_family_id <> recipient_family_id),
  check (proposer_adults + proposer_children between 1 and 30),
  check (
    (recipient_adults is null and recipient_children is null)
    or (recipient_adults + recipient_children between 1 and 30)
  ),
  check ((status = 'accepted') = (selected_option_id is not null)),
  check ((status in ('accepted', 'declined')) = (responded_at is not null)),
  check ((status = 'cancelled') = (cancelled_at is not null))
);

create table public.playdate_time_options (
  id uuid primary key default gen_random_uuid(),
  playdate_id uuid not null references public.playdates(id) on delete cascade,
  starts_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique(playdate_id, starts_at)
);

alter table public.playdates add constraint playdates_selected_option_fk
  foreign key (selected_option_id) references public.playdate_time_options(id);

create table kinavela_private.playdate_locations (
  playdate_id uuid primary key references public.playdates(id) on delete cascade,
  exact_address text not null check (char_length(btrim(exact_address)) between 5 and 300),
  created_at timestamptz not null default now()
);

create table public.playdate_reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  playdate_id uuid not null references public.playdates(id) on delete cascade,
  recipient_profile_id uuid not null references public.profiles(id) on delete cascade,
  reminder_kind text not null check (reminder_kind in ('scheduled_24h', 'organizer', 'cancelled')),
  due_at timestamptz not null,
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique(playdate_id, recipient_profile_id, reminder_kind),
  check (read_at is null or delivered_at is not null)
);

create table public.event_messages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  sender_profile_id uuid not null references public.profiles(id) on delete restrict,
  sender_family_id uuid not null references public.families(id) on delete restrict,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index playdates_connection_time_idx on public.playdates(connection_id, created_at desc);
create index playdate_options_time_idx on public.playdate_time_options(playdate_id, starts_at);
create index playdate_reminders_due_idx on public.playdate_reminder_deliveries(due_at)
  where delivered_at is null;
create index event_messages_event_time_idx on public.event_messages(event_id, created_at, id);

create trigger playdates_set_updated_at before update on public.playdates
  for each row execute function public.set_updated_at();

alter table public.playdates enable row level security;
alter table public.playdates force row level security;
alter table public.playdate_time_options enable row level security;
alter table public.playdate_time_options force row level security;
alter table public.playdate_reminder_deliveries enable row level security;
alter table public.playdate_reminder_deliveries force row level security;
alter table public.event_messages enable row level security;
alter table public.event_messages force row level security;

revoke all on public.playdates, public.playdate_time_options,
  public.playdate_reminder_deliveries, public.event_messages
  from public, anon, authenticated, service_role;
revoke all on kinavela_private.playdate_locations
  from public, anon, authenticated, service_role;

create or replace function kinavela_private.can_access_playdate(p_playdate_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.playdates playdate
    where playdate.id = p_playdate_id
      and kinavela_private.current_family_id(false) in (
        playdate.proposer_family_id, playdate.recipient_family_id
      )
      and exists (
        select 1 from public.family_connections connection
        where connection.id = playdate.connection_id
          and connection.status = 'accepted'
          and kinavela_private.families_are_connected(
            playdate.proposer_family_id, playdate.recipient_family_id
          )
      )
  )
$$;

create or replace function public.create_playdate(
  p_connection_id uuid, p_title text, p_approximate_location text,
  p_exact_address text, p_time_options timestamptz[],
  p_number_of_adults integer, p_number_of_children integer
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  profile_uuid uuid := public.current_profile_id();
  family_uuid uuid := kinavela_private.current_family_id(false);
  connection_row public.family_connections%rowtype;
  other_family_uuid uuid;
  playdate_uuid uuid := gen_random_uuid();
  option_time timestamptz;
begin
  if profile_uuid is null or family_uuid is null then raise exception 'not_authenticated'; end if;
  select * into connection_row from public.family_connections
  where id = p_connection_id and status = 'accepted' for update;
  if connection_row.id is null or family_uuid not in (
    connection_row.requester_family_id, connection_row.recipient_family_id
  ) then raise exception 'connection_not_available'; end if;
  other_family_uuid := case when family_uuid = connection_row.requester_family_id
    then connection_row.recipient_family_id else connection_row.requester_family_id end;
  if not kinavela_private.families_are_connected(family_uuid, other_family_uuid) then
    raise exception 'connection_not_available';
  end if;
  if char_length(btrim(p_title)) not between 3 and 120
    or char_length(btrim(p_approximate_location)) not between 2 and 240
    or char_length(btrim(p_exact_address)) not between 5 and 300
    or cardinality(p_time_options) not between 1 and 3
    or p_number_of_adults not between 0 and 10
    or p_number_of_children not between 0 and 20
    or p_number_of_adults + p_number_of_children not between 1 and 30
    or exists (select 1 from unnest(p_time_options) option_value where option_value <= now())
    or (select count(distinct option_value) from unnest(p_time_options) option_value)
      <> cardinality(p_time_options) then raise exception 'invalid_playdate'; end if;
  if (select count(*) from public.playdates where proposer_family_id = family_uuid
    and created_at >= now() - interval '24 hours') >= 10 then
    raise exception 'playdate_rate_limited';
  end if;
  insert into public.playdates(
    id, connection_id, proposer_family_id, recipient_family_id,
    proposer_profile_id, title, approximate_location, proposer_adults, proposer_children
  ) values (
    playdate_uuid, connection_row.id, family_uuid, other_family_uuid,
    profile_uuid, btrim(p_title), btrim(p_approximate_location),
    p_number_of_adults, p_number_of_children
  );
  foreach option_time in array p_time_options loop
    insert into public.playdate_time_options(playdate_id, starts_at)
    values (playdate_uuid, option_time);
  end loop;
  insert into kinavela_private.playdate_locations(playdate_id, exact_address)
  values (playdate_uuid, btrim(p_exact_address));
  insert into public.audit_events(actor_profile_id, event_type, entity_type, entity_id)
  values (profile_uuid, 'playdate_proposed', 'playdate', playdate_uuid);
  return playdate_uuid;
end;
$$;

create or replace function kinavela_private.queue_playdate_reminders(
  p_playdate_id uuid, p_kind text, p_due_at timestamptz
) returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.playdate_reminder_deliveries(
    playdate_id, recipient_profile_id, reminder_kind, due_at
  ) select p_playdate_id, member.profile_id, p_kind, p_due_at
    from public.playdates playdate
    join public.family_members member on member.family_id in (
      playdate.proposer_family_id, playdate.recipient_family_id
    ) and member.status = 'active'
    where playdate.id = p_playdate_id
  on conflict(playdate_id, recipient_profile_id, reminder_kind)
  do update set due_at = excluded.due_at, delivered_at = null, read_at = null;
end;
$$;

create or replace function public.respond_playdate(
  p_playdate_id uuid, p_accept boolean, p_option_id uuid default null,
  p_number_of_adults integer default 1, p_number_of_children integer default 0
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  profile_uuid uuid := public.current_profile_id();
  family_uuid uuid := kinavela_private.current_family_id(false);
  playdate_row public.playdates%rowtype;
  selected_time timestamptz;
begin
  select * into playdate_row from public.playdates where id = p_playdate_id for update;
  if profile_uuid is null or playdate_row.id is null or playdate_row.status <> 'proposed'
    or family_uuid <> playdate_row.recipient_family_id
    or not kinavela_private.can_access_playdate(p_playdate_id) then
    raise exception 'playdate_not_available'; end if;
  if p_accept then
    if p_option_id is null or p_number_of_adults not between 0 and 10
      or p_number_of_children not between 0 and 20
      or p_number_of_adults + p_number_of_children not between 1 and 30 then
      raise exception 'invalid_playdate_response'; end if;
    select starts_at into selected_time from public.playdate_time_options
      where id = p_option_id and playdate_id = p_playdate_id and starts_at > now();
    if selected_time is null then raise exception 'invalid_playdate_option'; end if;
    update public.playdates set status = 'accepted', selected_option_id = p_option_id,
      recipient_adults = p_number_of_adults, recipient_children = p_number_of_children,
      responded_at = now() where id = p_playdate_id;
    perform kinavela_private.queue_playdate_reminders(
      p_playdate_id, 'scheduled_24h', greatest(now(), selected_time - interval '24 hours')
    );
  else
    update public.playdates set status = 'declined', responded_at = now()
      where id = p_playdate_id;
  end if;
  insert into public.audit_events(actor_profile_id, event_type, entity_type, entity_id)
  values (profile_uuid, case when p_accept then 'playdate_accepted' else 'playdate_declined' end,
    'playdate', p_playdate_id);
  return true;
end;
$$;

create or replace function public.cancel_playdate(p_playdate_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare profile_uuid uuid := public.current_profile_id(); playdate_row public.playdates%rowtype;
begin
  select * into playdate_row from public.playdates where id = p_playdate_id for update;
  if profile_uuid is null or playdate_row.id is null
    or playdate_row.status not in ('proposed', 'accepted')
    or not kinavela_private.can_access_playdate(p_playdate_id) then
    raise exception 'playdate_not_available'; end if;
  update public.playdates set status = 'cancelled', cancelled_at = now(),
    selected_option_id = null, responded_at = null where id = p_playdate_id;
  delete from public.playdate_reminder_deliveries where playdate_id = p_playdate_id;
  perform kinavela_private.queue_playdate_reminders(p_playdate_id, 'cancelled', now());
  insert into public.audit_events(actor_profile_id, event_type, entity_type, entity_id)
  values (profile_uuid, 'playdate_cancelled', 'playdate', p_playdate_id);
  return true;
end;
$$;

create or replace function public.send_playdate_reminder(p_playdate_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare profile_uuid uuid := public.current_profile_id(); playdate_row public.playdates%rowtype;
begin
  select * into playdate_row from public.playdates where id = p_playdate_id for update;
  if profile_uuid is null or playdate_row.id is null or playdate_row.status <> 'accepted'
    or not kinavela_private.can_access_playdate(p_playdate_id) then
    raise exception 'playdate_not_available'; end if;
  if exists (select 1 from public.audit_events where actor_profile_id = profile_uuid
    and event_type = 'playdate_reminder_sent' and entity_id = p_playdate_id
    and created_at >= now() - interval '1 hour') then raise exception 'reminder_rate_limited'; end if;
  perform kinavela_private.queue_playdate_reminders(p_playdate_id, 'organizer', now());
  insert into public.audit_events(actor_profile_id, event_type, entity_type, entity_id)
  values (profile_uuid, 'playdate_reminder_sent', 'playdate', p_playdate_id);
  return 2;
end;
$$;

create or replace function public.mark_playdate_reminders_read(p_playdate_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare profile_uuid uuid := public.current_profile_id();
begin
  if not kinavela_private.can_access_playdate(p_playdate_id) then
    raise exception 'playdate_not_available'; end if;
  update public.playdate_reminder_deliveries set read_at = coalesce(read_at, now())
  where playdate_id = p_playdate_id and recipient_profile_id = profile_uuid
    and delivered_at is not null;
  return found;
end;
$$;

create or replace function public.dispatch_due_playdate_reminders()
returns integer language plpgsql security definer set search_path = '' as $$
declare delivered_count integer;
begin
  update public.playdate_reminder_deliveries delivery set delivered_at = now()
  from public.playdates playdate
  where playdate.id = delivery.playdate_id and delivery.delivered_at is null
    and delivery.due_at <= now()
    and (playdate.status = 'accepted' or delivery.reminder_kind = 'cancelled')
    and exists (select 1 from public.family_members member
      where member.profile_id = delivery.recipient_profile_id and member.status = 'active'
        and member.family_id in (playdate.proposer_family_id, playdate.recipient_family_id));
  get diagnostics delivered_count = row_count;
  return delivered_count;
end;
$$;

create or replace function public.list_my_playdates()
returns table (
  playdate_id uuid, connection_id uuid, other_family_id uuid, other_family_name text,
  title text, approximate_location text, exact_address text, status text,
  is_proposer boolean, time_options jsonb, selected_option_id uuid,
  selected_starts_at timestamptz, proposer_adults integer, proposer_children integer,
  recipient_adults integer, recipient_children integer, reminder_unread boolean,
  latest_reminder_kind text, created_at timestamptz
) language plpgsql stable security definer set search_path = '' as $$
declare family_uuid uuid := kinavela_private.current_family_id(false); profile_uuid uuid := public.current_profile_id();
begin
  if profile_uuid is null or family_uuid is null then raise exception 'not_authenticated'; end if;
  return query select playdate.id, playdate.connection_id,
    case when family_uuid = playdate.proposer_family_id then playdate.recipient_family_id else playdate.proposer_family_id end,
    other_family.name, playdate.title, playdate.approximate_location,
    case when playdate.status = 'accepted' then location.exact_address else null end,
    playdate.status, family_uuid = playdate.proposer_family_id,
    coalesce((select jsonb_agg(jsonb_build_object('option_id', option.id, 'starts_at', option.starts_at)
      order by option.starts_at) from public.playdate_time_options option
      where option.playdate_id = playdate.id), '[]'::jsonb),
    playdate.selected_option_id, selected.starts_at, playdate.proposer_adults,
    playdate.proposer_children, playdate.recipient_adults, playdate.recipient_children,
    exists (select 1 from public.playdate_reminder_deliveries reminder
      where reminder.playdate_id = playdate.id and reminder.recipient_profile_id = profile_uuid
        and reminder.delivered_at is not null and reminder.read_at is null),
    (select reminder.reminder_kind from public.playdate_reminder_deliveries reminder
      where reminder.playdate_id = playdate.id and reminder.recipient_profile_id = profile_uuid
        and reminder.delivered_at is not null order by reminder.delivered_at desc limit 1),
    playdate.created_at
  from public.playdates playdate
  join public.families other_family on other_family.id = case
    when family_uuid = playdate.proposer_family_id then playdate.recipient_family_id
    else playdate.proposer_family_id end
  join kinavela_private.playdate_locations location on location.playdate_id = playdate.id
  left join public.playdate_time_options selected on selected.id = playdate.selected_option_id
  where family_uuid in (playdate.proposer_family_id, playdate.recipient_family_id)
    and kinavela_private.can_access_playdate(playdate.id)
  order by (playdate.status in ('proposed', 'accepted')) desc,
    coalesce(selected.starts_at, playdate.created_at) desc;
end;
$$;

create or replace function public.submit_playdate_report(
  p_playdate_id uuid, p_reason text, p_details text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  profile_uuid uuid := public.current_profile_id();
  family_uuid uuid := kinavela_private.current_family_id(false);
  playdate_row public.playdates%rowtype; target_family_uuid uuid; report_uuid uuid;
  clean_details text := nullif(btrim(coalesce(p_details, '')), '');
begin
  select * into playdate_row from public.playdates where id = p_playdate_id;
  if profile_uuid is null or playdate_row.id is null
    or not kinavela_private.can_access_playdate(p_playdate_id) then
    raise exception 'playdate_not_available'; end if;
  if p_reason not in ('unsafe_location', 'inappropriate_conduct', 'child_safety_concern',
    'discrimination', 'fraud', 'other') or clean_details is not null
    and char_length(clean_details) > 900 then raise exception 'invalid_report'; end if;
  target_family_uuid := case when family_uuid = playdate_row.proposer_family_id
    then playdate_row.recipient_family_id else playdate_row.proposer_family_id end;
  insert into public.reports(reporter_profile_id, reporter_family_id, target_type,
    target_family_id, reason, details) values (profile_uuid, family_uuid, 'family',
    target_family_uuid, p_reason,
    concat('Private playdate reference ', p_playdate_id::text,
      case when clean_details is null then '' else ': ' || clean_details end))
  returning id into report_uuid;
  insert into public.audit_events(actor_profile_id, event_type, entity_type, entity_id,
    metadata) values (profile_uuid, 'playdate_report_submitted', 'report', report_uuid,
      jsonb_build_object('playdate_id', p_playdate_id));
  return report_uuid;
end;
$$;

create or replace function public.list_event_messages(
  p_event_id uuid, p_before timestamptz default null, p_limit integer default 100
) returns table(message_id uuid, sender_display_name text, body text,
  created_at timestamptz, is_own_family boolean)
language plpgsql stable security definer set search_path = '' as $$
declare event_row public.events%rowtype; family_uuid uuid := kinavela_private.current_family_id(false);
begin
  select * into event_row from public.events where id = p_event_id;
  if event_row.id is null or not kinavela_private.is_village_family_member(
    event_row.village_id, family_uuid, false) then raise exception 'event_not_available'; end if;
  return query select message.id, profile.display_name,
    case when message.deleted_at is null then message.body else '[removed]' end,
    message.created_at, message.sender_family_id = family_uuid
  from public.event_messages message join public.profiles profile on profile.id = message.sender_profile_id
  where message.event_id = p_event_id and (p_before is null or message.created_at < p_before)
  order by message.created_at desc, message.id desc limit least(greatest(p_limit, 1), 100);
end;
$$;

create or replace function public.send_event_message(p_event_id uuid, p_body text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare profile_uuid uuid := public.current_profile_id(); family_uuid uuid := kinavela_private.current_family_id(false);
  event_row public.events%rowtype; message_uuid uuid;
begin
  select * into event_row from public.events where id = p_event_id;
  if profile_uuid is null or event_row.id is null or event_row.moderation_status <> 'clear'
    or not kinavela_private.is_village_family_member(event_row.village_id, family_uuid, false)
    or char_length(btrim(p_body)) not between 1 and 2000 then raise exception 'event_not_available'; end if;
  if (select count(*) from public.event_messages where sender_profile_id = profile_uuid
    and created_at >= now() - interval '1 minute') >= 10 then raise exception 'message_rate_limited'; end if;
  insert into public.event_messages(event_id, sender_profile_id, sender_family_id, body)
    values (p_event_id, profile_uuid, family_uuid, btrim(p_body)) returning id into message_uuid;
  return message_uuid;
end;
$$;

alter table public.events add column recurrence_frequency text
  check (recurrence_frequency in ('weekly', 'biweekly', 'monthly')),
  add column recurrence_ends_on date,
  add column recurrence_series_id uuid,
  add column recurrence_index integer not null default 0 check (recurrence_index between 0 and 51);
create index events_recurrence_series_idx on public.events(recurrence_series_id, recurrence_index)
  where recurrence_series_id is not null;

drop function public.create_village_event(uuid,text,text,text,timestamptz,timestamptz,text,text,text,text,text,integer,timestamptz);
create function public.create_village_event(
  p_village_id uuid, p_title text, p_description text, p_category text,
  p_starts_at timestamptz, p_ends_at timestamptz, p_location_name text,
  p_location_city text, p_location_address text, p_public_location_description text,
  p_address_visibility text, p_max_families integer,
  p_registration_deadline timestamptz,
  p_recurrence_frequency text, p_recurrence_ends_on date
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  profile_uuid uuid := public.current_profile_id(); family_uuid uuid := kinavela_private.current_family_id(false);
  first_event_uuid uuid := gen_random_uuid(); event_uuid uuid; series_uuid uuid;
  current_start timestamptz := p_starts_at; current_end timestamptz := p_ends_at;
  current_deadline timestamptz := coalesce(p_registration_deadline, p_starts_at);
  occurrence integer := 0;
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  if family_uuid is null or not kinavela_private.can_manage_village_events(p_village_id) then raise exception 'not_authorized'; end if;
  if p_starts_at <= now() or p_ends_at <= p_starts_at or current_deadline > p_starts_at
    or p_category not in ('playdate','park','picnic','cooking','language','cultural','sports','creative','family_support','celebration','other')
    or p_address_visibility not in ('going','all_members')
    or p_max_families is not null and p_max_families not between 1 and 100
    or p_recurrence_frequency is not null and p_recurrence_frequency not in ('weekly','biweekly','monthly')
    or (p_recurrence_frequency is null) <> (p_recurrence_ends_on is null)
    or p_recurrence_ends_on is not null and (p_recurrence_ends_on < p_starts_at::date
      or p_recurrence_ends_on > (p_starts_at + interval '1 year')::date) then raise exception 'invalid_event'; end if;
  if (select count(*) from public.events where creator_family_id = family_uuid
    and created_at >= now() - interval '24 hours') >= 52 then raise exception 'event_create_rate_limited'; end if;
  series_uuid := case when p_recurrence_frequency is null then null else gen_random_uuid() end;
  loop
    exit when occurrence >= 52 or (p_recurrence_ends_on is not null and current_start::date > p_recurrence_ends_on);
    event_uuid := case when occurrence = 0 then first_event_uuid else gen_random_uuid() end;
    insert into public.events(id,village_id,creator_family_id,creator_profile_id,title,description,
      category,starts_at,ends_at,location_name,location_city,public_location_description,
      address_visibility,max_families,registration_deadline,recurrence_frequency,
      recurrence_ends_on,recurrence_series_id,recurrence_index)
    values(event_uuid,p_village_id,family_uuid,profile_uuid,btrim(p_title),btrim(p_description),
      p_category,current_start,current_end,btrim(p_location_name),btrim(p_location_city),
      btrim(p_public_location_description),p_address_visibility,p_max_families,current_deadline,
      p_recurrence_frequency,p_recurrence_ends_on,series_uuid,occurrence);
    insert into kinavela_private.event_locations(event_id,location_address)
      values(event_uuid,btrim(p_location_address));
    occurrence := occurrence + 1;
    exit when p_recurrence_frequency is null;
    if p_recurrence_frequency = 'weekly' then
      current_start := current_start + interval '1 week'; current_end := current_end + interval '1 week'; current_deadline := current_deadline + interval '1 week';
    elsif p_recurrence_frequency = 'biweekly' then
      current_start := current_start + interval '2 weeks'; current_end := current_end + interval '2 weeks'; current_deadline := current_deadline + interval '2 weeks';
    else
      current_start := current_start + interval '1 month'; current_end := current_end + interval '1 month'; current_deadline := current_deadline + interval '1 month';
    end if;
  end loop;
  insert into public.audit_events(actor_profile_id,event_type,entity_type,entity_id,metadata)
    values(profile_uuid,'event_created','event',first_event_uuid,
      jsonb_build_object('recurrence',p_recurrence_frequency,'occurrences',occurrence));
  return first_event_uuid;
end;
$$;

drop function public.list_village_events(uuid);
create function public.list_village_events(p_village_id uuid)
returns table (
  event_id uuid, village_id uuid, title text, description text, category text,
  starts_at timestamptz, ends_at timestamptz, location_name text, location_city text,
  public_location_description text, location_address text, address_visible boolean,
  address_visibility text, max_families integer, registration_deadline timestamptz,
  status text, creator_family_name text, current_rsvp_status text,
  number_of_adults integer, number_of_children integer, going_count integer,
  maybe_count integer, waitlist_count integer, attended_count integer,
  can_manage boolean, reminder_unread boolean, latest_reminder_kind text,
  recurrence_frequency text, recurrence_ends_on date, recurrence_series_id uuid,
  recurrence_index integer
) language plpgsql stable security definer set search_path = '' as $$
declare family_uuid uuid := kinavela_private.current_family_id(false); profile_uuid uuid := public.current_profile_id();
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  if not kinavela_private.can_access_village(p_village_id, false) then raise exception 'village_not_available'; end if;
  return query select event.id,event.village_id,event.title,event.description,event.category,
    event.starts_at,event.ends_at,event.location_name,event.location_city,event.public_location_description,
    case when kinavela_private.can_view_event_address(event.id) then location.location_address else null end,
    kinavela_private.can_view_event_address(event.id),event.address_visibility,event.max_families,
    event.registration_deadline,event.status,creator.name,attendance.status,attendance.number_of_adults,
    attendance.number_of_children,
    (select count(*)::integer from public.event_attendees x where x.event_id=event.id and x.status='going'),
    (select count(*)::integer from public.event_attendees x where x.event_id=event.id and x.status='maybe'),
    (select count(*)::integer from public.event_attendees x where x.event_id=event.id and x.status='waitlisted'),
    (select count(*)::integer from public.event_attendees x where x.event_id=event.id and x.attendance_confirmed_at is not null),
    kinavela_private.can_manage_village_events(event.village_id),
    exists(select 1 from public.event_reminder_deliveries reminder where reminder.event_id=event.id
      and reminder.recipient_profile_id=profile_uuid and reminder.delivered_at is not null and reminder.read_at is null),
    (select reminder.reminder_kind from public.event_reminder_deliveries reminder where reminder.event_id=event.id
      and reminder.recipient_profile_id=profile_uuid and reminder.delivered_at is not null order by reminder.delivered_at desc limit 1),
    event.recurrence_frequency,event.recurrence_ends_on,event.recurrence_series_id,event.recurrence_index
  from public.events event join public.families creator on creator.id=event.creator_family_id
  join kinavela_private.event_locations location on location.event_id=event.id
  left join public.event_attendees attendance on attendance.event_id=event.id and attendance.family_id=family_uuid
  where event.village_id=p_village_id
  order by (event.status='scheduled') desc,event.starts_at,event.id;
end;
$$;

revoke all on function kinavela_private.can_access_playdate(uuid),
  kinavela_private.queue_playdate_reminders(uuid,text,timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function public.create_playdate(uuid,text,text,text,timestamptz[],integer,integer),
  public.respond_playdate(uuid,boolean,uuid,integer,integer), public.cancel_playdate(uuid),
  public.send_playdate_reminder(uuid), public.mark_playdate_reminders_read(uuid),
  public.dispatch_due_playdate_reminders(), public.list_my_playdates(),
  public.submit_playdate_report(uuid,text,text), public.list_event_messages(uuid,timestamptz,integer),
  public.send_event_message(uuid,text),
  public.create_village_event(uuid,text,text,text,timestamptz,timestamptz,text,text,text,text,text,integer,timestamptz,text,date),
  public.list_village_events(uuid) from public, anon, authenticated, service_role;
grant execute on function public.create_playdate(uuid,text,text,text,timestamptz[],integer,integer),
  public.respond_playdate(uuid,boolean,uuid,integer,integer), public.cancel_playdate(uuid),
  public.send_playdate_reminder(uuid), public.mark_playdate_reminders_read(uuid),
  public.list_my_playdates(), public.submit_playdate_report(uuid,text,text),
  public.list_event_messages(uuid,timestamptz,integer), public.send_event_message(uuid,text),
  public.create_village_event(uuid,text,text,text,timestamptz,timestamptz,text,text,text,text,text,integer,timestamptz,text,date),
  public.list_village_events(uuid) to authenticated;
grant execute on function public.dispatch_due_playdate_reminders() to service_role;

create function public.create_village_event(
  p_village_id uuid, p_title text, p_description text, p_category text,
  p_starts_at timestamptz, p_ends_at timestamptz, p_location_name text,
  p_location_city text, p_location_address text, p_public_location_description text,
  p_address_visibility text, p_max_families integer, p_registration_deadline timestamptz
) returns uuid language sql security invoker set search_path = '' as $$
  select public.create_village_event(
    p_village_id,p_title,p_description,p_category,p_starts_at,p_ends_at,
    p_location_name,p_location_city,p_location_address,p_public_location_description,
    p_address_visibility,p_max_families,p_registration_deadline,null,null
  )
$$;

revoke all on function public.create_village_event(uuid,text,text,text,timestamptz,timestamptz,text,text,text,text,text,integer,timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.create_village_event(uuid,text,text,text,timestamptz,timestamptz,text,text,text,text,text,integer,timestamptz)
  to authenticated;

insert into kinavela_private.retention_policies(policy_key,resource,retention_days,action,notes)
values ('playdate_reminder_deliveries','playdate_reminder_deliveries.created_at',90,'delete',
  'Remove private playdate reminder recipient payloads after 90 days.')
on conflict(policy_key) do update set resource=excluded.resource,
  retention_days=excluded.retention_days,action=excluded.action,notes=excluded.notes,
  updated_at=now();

insert into kinavela_private.schema_migrations(version)
values ('202608130012_offline_activity_coordination');
notify pgrst, 'reload schema';
commit;
