begin;

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  conversation_type text not null default 'family' check (conversation_type in ('family', 'village', 'event')),
  family_connection_id uuid not null unique references public.family_connections(id) on delete cascade,
  created_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (conversation_type = 'family')
);

create index conversations_last_message_idx
  on public.conversations(last_message_at desc nulls last);

create table public.conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  muted_at timestamptz,
  joined_at timestamptz not null default now(),
  unique(conversation_id, profile_id)
);

create index conversation_participants_profile_idx
  on public.conversation_participants(profile_id, conversation_id);
create index conversation_participants_family_idx
  on public.conversation_participants(family_id, conversation_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_profile_id uuid not null references public.profiles(id) on delete restrict,
  sender_family_id uuid not null references public.families(id) on delete restrict,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  message_type text not null default 'text' check (message_type = 'text'),
  reply_to uuid references public.messages(id) on delete set null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  check (edited_at is null or edited_at >= created_at),
  check (deleted_at is null or deleted_at >= created_at)
);

create index messages_conversation_created_idx
  on public.messages(conversation_id, created_at desc, id desc);
create index messages_sender_rate_idx
  on public.messages(sender_profile_id, created_at desc);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_profile_id uuid not null references public.profiles(id) on delete restrict,
  reporter_family_id uuid not null references public.families(id) on delete restrict,
  target_type text not null check (target_type in ('family', 'message')),
  target_family_id uuid not null references public.families(id) on delete restrict,
  target_message_id uuid references public.messages(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  reason text not null check (reason in (
    'harassment', 'spam', 'fraud', 'unsafe_behavior',
    'inappropriate_child_content', 'discrimination', 'impersonation', 'other'
  )),
  details text check (details is null or char_length(details) between 1 and 1000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (target_type = 'family' and target_message_id is null)
    or (target_type = 'message' and target_message_id is not null and conversation_id is not null)
  ),
  check (reporter_family_id <> target_family_id)
);

create index reports_reporter_created_idx
  on public.reports(reporter_profile_id, created_at desc);
create index reports_moderation_queue_idx
  on public.reports(status, created_at);
create index reports_target_family_idx
  on public.reports(target_family_id, created_at desc);

alter table public.conversations enable row level security;
alter table public.conversations force row level security;
alter table public.conversation_participants enable row level security;
alter table public.conversation_participants force row level security;
alter table public.messages enable row level security;
alter table public.messages force row level security;
alter table public.reports enable row level security;
alter table public.reports force row level security;

create trigger conversations_set_updated_at
  before update on public.conversations
  for each row execute function public.set_updated_at();
create trigger reports_set_updated_at
  before update on public.reports
  for each row execute function public.set_updated_at();

create or replace function kinavela_private.can_access_family_conversation(
  p_conversation_id uuid,
  p_require_connected boolean default true
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversations c
    join public.family_connections fc on fc.id = c.family_connection_id
    join public.family_members fm on fm.family_id in (fc.requester_family_id, fc.recipient_family_id)
    join public.profiles p on p.id = fm.profile_id
    where c.id = p_conversation_id
      and c.conversation_type = 'family'
      and p.auth_user_id = auth.uid()
      and p.status = 'active'
      and fm.status = 'active'
      and (
        not p_require_connected
        or kinavela_private.families_are_connected(fc.requester_family_id, fc.recipient_family_id)
      )
  )
$$;

revoke all on function kinavela_private.can_access_family_conversation(uuid, boolean)
  from public, anon, authenticated, service_role;

create or replace function public.can_access_family_conversation(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select kinavela_private.can_access_family_conversation(p_conversation_id, true)
$$;

revoke all on function public.can_access_family_conversation(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.can_access_family_conversation(uuid) to authenticated;

create policy "Connected families read conversations"
  on public.conversations for select to authenticated
  using (public.can_access_family_conversation(id));

create policy "Connected families read participants"
  on public.conversation_participants for select to authenticated
  using (public.can_access_family_conversation(conversation_id));

create policy "Connected families read messages"
  on public.messages for select to authenticated
  using (public.can_access_family_conversation(conversation_id));

create policy "Reporters read own reports"
  on public.reports for select to authenticated
  using (reporter_profile_id = public.current_profile_id());

revoke all on public.conversations, public.conversation_participants,
  public.messages, public.reports from public, anon, authenticated;
grant select on public.conversations, public.conversation_participants,
  public.messages, public.reports to authenticated;

alter table public.notifications
  drop constraint notifications_notification_type_check;
alter table public.notifications
  add constraint notifications_notification_type_check
  check (notification_type in ('connection_request', 'connection_accepted', 'message_received'));

create or replace function public.get_or_create_family_conversation(p_other_family_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_uuid uuid := public.current_profile_id();
  family_uuid uuid := kinavela_private.current_family_id(false);
  connection_uuid uuid;
  conversation_uuid uuid;
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  if family_uuid is null or family_uuid = p_other_family_id then raise exception 'not_authorized'; end if;

  select fc.id into connection_uuid
  from public.family_connections fc
  where least(fc.requester_family_id, fc.recipient_family_id) = least(family_uuid, p_other_family_id)
    and greatest(fc.requester_family_id, fc.recipient_family_id) = greatest(family_uuid, p_other_family_id)
    and fc.status = 'accepted'
    and kinavela_private.families_are_connected(fc.requester_family_id, fc.recipient_family_id)
  for update;
  if connection_uuid is null then raise exception 'connection_required'; end if;

  insert into public.conversations(family_connection_id, created_by_profile_id)
  values (connection_uuid, profile_uuid)
  on conflict(family_connection_id) do update
    set family_connection_id = excluded.family_connection_id
  returning id into conversation_uuid;

  insert into public.conversation_participants(conversation_id, family_id, profile_id)
  select conversation_uuid, fm.family_id, fm.profile_id
  from public.family_members fm
  join public.profiles p on p.id = fm.profile_id and p.status = 'active'
  where fm.family_id in (family_uuid, p_other_family_id) and fm.status = 'active'
  on conflict on constraint conversation_participants_conversation_id_profile_id_key do nothing;

  return conversation_uuid;
end;
$$;

create or replace function public.list_family_conversations()
returns table (
  conversation_id uuid,
  other_family_id uuid,
  other_family_name text,
  last_message_preview text,
  last_message_at timestamptz,
  unread_count integer,
  muted boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_uuid uuid := public.current_profile_id();
  family_uuid uuid := kinavela_private.current_family_id(false);
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  if family_uuid is null then raise exception 'family_not_found'; end if;

  insert into public.conversation_participants(conversation_id, family_id, profile_id)
  select c.id, family_uuid, profile_uuid
  from public.conversations c
  join public.family_connections fc on fc.id = c.family_connection_id
  where family_uuid in (fc.requester_family_id, fc.recipient_family_id)
    and kinavela_private.families_are_connected(fc.requester_family_id, fc.recipient_family_id)
  on conflict on constraint conversation_participants_conversation_id_profile_id_key do nothing;

  return query
  select c.id,
    other_family.id,
    other_family.name,
    case when latest.deleted_at is null then left(latest.body, 160) else null end,
    latest.created_at,
    coalesce((
      select count(*)::integer
      from public.messages unread
      where unread.conversation_id = c.id
        and unread.sender_family_id <> family_uuid
        and unread.created_at > cp.last_read_at
        and unread.deleted_at is null
    ), 0),
    cp.muted_at is not null
  from public.conversations c
  join public.family_connections fc on fc.id = c.family_connection_id
  join public.conversation_participants cp
    on cp.conversation_id = c.id and cp.profile_id = profile_uuid
  join public.families other_family on other_family.id = case
    when fc.requester_family_id = family_uuid then fc.recipient_family_id
    else fc.requester_family_id
  end
  left join lateral (
    select m.body, m.created_at, m.deleted_at
    from public.messages m
    where m.conversation_id = c.id
    order by m.created_at desc, m.id desc
    limit 1
  ) latest on true
  where family_uuid in (fc.requester_family_id, fc.recipient_family_id)
    and kinavela_private.families_are_connected(fc.requester_family_id, fc.recipient_family_id)
  order by coalesce(latest.created_at, c.created_at) desc, c.id;
end;
$$;

create or replace function public.list_conversation_messages(
  p_conversation_id uuid,
  p_before timestamptz default null,
  p_limit integer default 50
)
returns table (
  message_id uuid,
  conversation_id uuid,
  sender_profile_id uuid,
  sender_family_id uuid,
  sender_display_name text,
  body text,
  reply_to uuid,
  is_own_family boolean,
  created_at timestamptz
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
  if p_limit not between 1 and 100 then raise exception 'invalid_limit'; end if;
  if not kinavela_private.can_access_family_conversation(p_conversation_id, true) then
    raise exception 'conversation_not_available';
  end if;

  return query
  select m.id, m.conversation_id, m.sender_profile_id, m.sender_family_id,
    p.display_name, m.body, m.reply_to, m.sender_family_id = family_uuid, m.created_at
  from public.messages m
  join public.profiles p on p.id = m.sender_profile_id
  where m.conversation_id = p_conversation_id
    and m.deleted_at is null
    and (p_before is null or m.created_at < p_before)
  order by m.created_at desc, m.id desc
  limit p_limit;
end;
$$;

create or replace function public.send_family_message(
  p_conversation_id uuid,
  p_body text,
  p_reply_to uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_uuid uuid := public.current_profile_id();
  family_uuid uuid := kinavela_private.current_family_id(false);
  connection public.family_connections%rowtype;
  message_uuid uuid;
  clean_body text := btrim(p_body);
  recent_minute integer;
  recent_day integer;
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  if family_uuid is null then raise exception 'family_not_found'; end if;
  if char_length(clean_body) not between 1 and 2000 then raise exception 'invalid_message'; end if;
  if not kinavela_private.can_access_family_conversation(p_conversation_id, true) then
    raise exception 'conversation_not_available';
  end if;

  select fc.* into connection
  from public.conversations c
  join public.family_connections fc on fc.id = c.family_connection_id
  where c.id = p_conversation_id
  for update of c;

  if p_reply_to is not null and not exists (
    select 1 from public.messages reply
    where reply.id = p_reply_to
      and reply.conversation_id = p_conversation_id
      and reply.deleted_at is null
  ) then raise exception 'invalid_reply'; end if;

  select count(*) into recent_minute from public.messages
  where sender_profile_id = profile_uuid and created_at >= now() - interval '1 minute';
  select count(*) into recent_day from public.messages
  where sender_profile_id = profile_uuid and created_at >= now() - interval '24 hours';
  if recent_minute >= 30 or recent_day >= 500 then raise exception 'message_rate_limited'; end if;

  insert into public.messages(
    conversation_id, sender_profile_id, sender_family_id, body, reply_to
  ) values (p_conversation_id, profile_uuid, family_uuid, clean_body, p_reply_to)
  returning id into message_uuid;

  update public.conversations set last_message_at = now() where id = p_conversation_id;

  insert into public.conversation_participants(conversation_id, family_id, profile_id)
  select p_conversation_id, fm.family_id, fm.profile_id
  from public.family_members fm
  join public.profiles p on p.id = fm.profile_id and p.status = 'active'
  where fm.family_id in (connection.requester_family_id, connection.recipient_family_id)
    and fm.status = 'active'
  on conflict on constraint conversation_participants_conversation_id_profile_id_key do nothing;

  insert into public.notifications(
    recipient_profile_id, notification_type, actor_family_id, connection_id
  )
  select cp.profile_id, 'message_received', family_uuid, connection.id
  from public.conversation_participants cp
  where cp.conversation_id = p_conversation_id
    and cp.family_id <> family_uuid
    and cp.muted_at is null
  on conflict(recipient_profile_id, notification_type, connection_id) do update
    set actor_family_id = excluded.actor_family_id,
        read_at = null,
        created_at = now();

  return message_uuid;
end;
$$;

create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_uuid uuid := public.current_profile_id();
  family_uuid uuid := kinavela_private.current_family_id(false);
  connection_uuid uuid;
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  if not kinavela_private.can_access_family_conversation(p_conversation_id, true) then
    raise exception 'conversation_not_available';
  end if;
  select c.family_connection_id into connection_uuid
  from public.conversations c where c.id = p_conversation_id;
  insert into public.conversation_participants(
    conversation_id, family_id, profile_id, last_read_at
  ) values (p_conversation_id, family_uuid, profile_uuid, now())
  on conflict on constraint conversation_participants_conversation_id_profile_id_key
  do update set last_read_at = now();
  update public.notifications set read_at = coalesce(read_at, now())
  where recipient_profile_id = profile_uuid
    and notification_type = 'message_received'
    and connection_id = connection_uuid;
  return true;
end;
$$;

create or replace function public.set_conversation_muted(
  p_conversation_id uuid,
  p_muted boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_uuid uuid := public.current_profile_id();
  family_uuid uuid := kinavela_private.current_family_id(false);
  connection_uuid uuid;
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  if not kinavela_private.can_access_family_conversation(p_conversation_id, true) then
    raise exception 'conversation_not_available';
  end if;
  select family_connection_id into connection_uuid
  from public.conversations where id = p_conversation_id;
  insert into public.conversation_participants(
    conversation_id, family_id, profile_id, muted_at
  ) values (
    p_conversation_id, family_uuid, profile_uuid,
    case when p_muted then now() else null end
  )
  on conflict on constraint conversation_participants_conversation_id_profile_id_key do update
    set muted_at = case when p_muted then now() else null end;
  if p_muted then
    delete from public.notifications
    where recipient_profile_id = profile_uuid
      and notification_type = 'message_received'
      and connection_id = connection_uuid;
  end if;
  return true;
end;
$$;

create or replace function public.get_unread_message_count()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_uuid uuid := public.current_profile_id();
  family_uuid uuid := kinavela_private.current_family_id(false);
  result_count integer;
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  select count(*)::integer into result_count
  from public.messages m
  join public.conversation_participants cp
    on cp.conversation_id = m.conversation_id and cp.profile_id = profile_uuid
  where m.sender_family_id <> family_uuid
    and m.created_at > cp.last_read_at
    and m.deleted_at is null
    and kinavela_private.can_access_family_conversation(m.conversation_id, true);
  return coalesce(result_count, 0);
end;
$$;

create or replace function public.submit_report(
  p_target_type text,
  p_target_id uuid,
  p_reason text,
  p_details text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_uuid uuid := public.current_profile_id();
  family_uuid uuid := kinavela_private.current_family_id(false);
  target_family_uuid uuid;
  target_message_uuid uuid;
  conversation_uuid uuid;
  report_uuid uuid;
  clean_details text := nullif(btrim(coalesce(p_details, '')), '');
  recent_reports integer;
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  if p_target_type not in ('family', 'message') then raise exception 'invalid_report_target'; end if;
  if p_reason not in (
    'harassment', 'spam', 'fraud', 'unsafe_behavior',
    'inappropriate_child_content', 'discrimination', 'impersonation', 'other'
  ) then raise exception 'invalid_report_reason'; end if;
  if clean_details is not null and char_length(clean_details) > 1000 then
    raise exception 'invalid_report_details';
  end if;
  select count(*) into recent_reports from public.reports
  where reporter_profile_id = profile_uuid and created_at >= now() - interval '24 hours';
  if recent_reports >= 5 then raise exception 'report_rate_limited'; end if;

  if p_target_type = 'family' then
    target_family_uuid := p_target_id;
    if target_family_uuid = family_uuid or not exists (
      select 1 from public.family_connections fc
      where family_uuid in (fc.requester_family_id, fc.recipient_family_id)
        and target_family_uuid in (fc.requester_family_id, fc.recipient_family_id)
    ) then raise exception 'report_target_not_available'; end if;
  else
    select m.id, m.sender_family_id, m.conversation_id
    into target_message_uuid, target_family_uuid, conversation_uuid
    from public.messages m
    join public.conversations c on c.id = m.conversation_id
    join public.family_connections fc on fc.id = c.family_connection_id
    where m.id = p_target_id
      and family_uuid in (fc.requester_family_id, fc.recipient_family_id);
    if target_message_uuid is null or target_family_uuid = family_uuid then
      raise exception 'report_target_not_available';
    end if;
  end if;

  insert into public.reports(
    reporter_profile_id, reporter_family_id, target_type, target_family_id,
    target_message_id, conversation_id, reason, details
  ) values (
    profile_uuid, family_uuid, p_target_type, target_family_uuid,
    target_message_uuid, conversation_uuid, p_reason, clean_details
  ) returning id into report_uuid;

  insert into public.audit_events(actor_profile_id, event_type, entity_type, entity_id)
  values (profile_uuid, 'report_submitted', 'report', report_uuid);
  return report_uuid;
end;
$$;

revoke all on function public.get_or_create_family_conversation(uuid),
  public.list_family_conversations(),
  public.list_conversation_messages(uuid, timestamptz, integer),
  public.send_family_message(uuid, text, uuid),
  public.mark_conversation_read(uuid),
  public.set_conversation_muted(uuid, boolean),
  public.get_unread_message_count(),
  public.submit_report(text, uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.get_or_create_family_conversation(uuid),
  public.list_family_conversations(),
  public.list_conversation_messages(uuid, timestamptz, integer),
  public.send_family_message(uuid, text, uuid),
  public.mark_conversation_read(uuid),
  public.set_conversation_muted(uuid, boolean),
  public.get_unread_message_count(),
  public.submit_report(text, uuid, text, text)
  to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end
$$;

insert into kinavela_private.schema_migrations(version)
values ('202608090009_family_messaging')
on conflict (version) do nothing;

notify pgrst, 'reload schema';
commit;
