begin;

create or replace function kinavela_private.enforce_message_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  connection public.family_connections%rowtype;
  recent_minute integer;
  recent_day integer;
begin
  new.body := btrim(new.body);
  if char_length(new.body) not between 1 and 2000 or new.message_type <> 'text' then
    raise exception 'invalid_message';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('message-rate:' || new.sender_profile_id::text, 0));
  select fc.* into connection
  from public.conversations c
  join public.family_connections fc on fc.id = c.family_connection_id
  where c.id = new.conversation_id
  for update of fc;
  if connection.id is null
     or connection.status <> 'accepted'
     or not kinavela_private.families_are_connected(
       connection.requester_family_id,
       connection.recipient_family_id
     ) then raise exception 'conversation_not_available'; end if;
  if new.sender_family_id not in (
    connection.requester_family_id,
    connection.recipient_family_id
  ) then raise exception 'not_authorized'; end if;
  if not exists (
    select 1
    from public.family_members fm
    join public.profiles p on p.id = fm.profile_id
    where fm.family_id = new.sender_family_id
      and fm.profile_id = new.sender_profile_id
      and fm.status = 'active'
      and p.status = 'active'
  ) then raise exception 'not_authorized'; end if;
  if new.reply_to is not null and not exists (
    select 1 from public.messages reply
    where reply.id = new.reply_to
      and reply.conversation_id = new.conversation_id
      and reply.deleted_at is null
  ) then raise exception 'invalid_reply'; end if;

  select count(*) into recent_minute from public.messages
  where sender_profile_id = new.sender_profile_id
    and created_at >= clock_timestamp() - interval '1 minute';
  select count(*) into recent_day from public.messages
  where sender_profile_id = new.sender_profile_id
    and created_at >= clock_timestamp() - interval '24 hours';
  if recent_minute >= 30 or recent_day >= 500 then
    raise exception 'message_rate_limited';
  end if;
  return new;
end;
$$;

create or replace function kinavela_private.enforce_report_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent_reports integer;
begin
  new.details := nullif(btrim(coalesce(new.details, '')), '');
  if new.details is not null and char_length(new.details) > 1000 then
    raise exception 'invalid_report_details';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('report-rate:' || new.reporter_profile_id::text, 0));
  select count(*) into recent_reports from public.reports
  where reporter_profile_id = new.reporter_profile_id
    and created_at >= clock_timestamp() - interval '24 hours';
  if recent_reports >= 5 then raise exception 'report_rate_limited'; end if;

  if not exists (
    select 1
    from public.family_members fm
    join public.profiles p on p.id = fm.profile_id
    where fm.family_id = new.reporter_family_id
      and fm.profile_id = new.reporter_profile_id
      and fm.status = 'active'
      and p.status = 'active'
  ) then raise exception 'not_authorized'; end if;

  if new.target_type = 'family' then
    if new.target_message_id is not null or new.conversation_id is not null
       or not exists (
         select 1 from public.family_connections fc
         where new.reporter_family_id in (fc.requester_family_id, fc.recipient_family_id)
           and new.target_family_id in (fc.requester_family_id, fc.recipient_family_id)
       ) then raise exception 'report_target_not_available'; end if;
  elsif new.target_type = 'message' then
    if not exists (
      select 1
      from public.messages m
      join public.conversations c on c.id = m.conversation_id
      join public.family_connections fc on fc.id = c.family_connection_id
      where m.id = new.target_message_id
        and m.conversation_id = new.conversation_id
        and m.sender_family_id = new.target_family_id
        and new.reporter_family_id in (fc.requester_family_id, fc.recipient_family_id)
        and new.target_family_id in (fc.requester_family_id, fc.recipient_family_id)
    ) then raise exception 'report_target_not_available'; end if;
  else
    raise exception 'invalid_report_target';
  end if;
  return new;
end;
$$;

revoke all on function kinavela_private.enforce_message_insert(),
  kinavela_private.enforce_report_insert()
  from public, anon, authenticated, service_role;

create trigger messages_enforce_insert
  before insert on public.messages
  for each row execute function kinavela_private.enforce_message_insert();
create trigger reports_enforce_insert
  before insert on public.reports
  for each row execute function kinavela_private.enforce_report_insert();

insert into kinavela_private.schema_migrations(version)
values ('202608090011_messaging_insert_guards')
on conflict (version) do nothing;

notify pgrst, 'reload schema';
commit;
