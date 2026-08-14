begin;

create or replace function kinavela_private.enforce_report_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare recent_reports integer;
begin
  new.details := nullif(btrim(coalesce(new.details, '')), '');
  if new.details is not null and char_length(new.details) > 1000 then
    raise exception 'invalid_report_details';
  end if;
  perform pg_advisory_xact_lock(
    hashtextextended('report-rate:' || new.reporter_profile_id::text, 0)
  );
  select count(*) into recent_reports
  from public.reports
  where reporter_profile_id = new.reporter_profile_id
    and created_at >= clock_timestamp() - interval '24 hours';
  if recent_reports >= 5 then raise exception 'report_rate_limited'; end if;
  if not exists (
    select 1
    from public.family_members member
    join public.profiles profile on profile.id = member.profile_id
    where member.family_id = new.reporter_family_id
      and member.profile_id = new.reporter_profile_id
      and member.status = 'active'
      and profile.status = 'active'
  ) then raise exception 'not_authorized'; end if;

  if new.target_type = 'family' then
    if new.target_message_id is not null or new.conversation_id is not null
      or new.target_village_id is not null or new.target_event_id is not null
      or not exists (
        select 1 from public.family_connections connection
        where new.reporter_family_id in (
          connection.requester_family_id, connection.recipient_family_id
        )
        and new.target_family_id in (
          connection.requester_family_id, connection.recipient_family_id
        )
      ) then raise exception 'report_target_not_available'; end if;
  elsif new.target_type = 'village' then
    if new.target_event_id is not null
      or not kinavela_private.is_village_family_member(
        new.target_village_id, new.reporter_family_id, false
      ) then raise exception 'report_target_not_available'; end if;
  elsif new.target_type = 'message' then
    if new.target_event_id is not null or not exists (
      select 1
      from public.messages message
      join public.conversations conversation on conversation.id = message.conversation_id
      where message.id = new.target_message_id
        and message.conversation_id = new.conversation_id
        and message.sender_family_id = new.target_family_id
        and (
          (
            conversation.conversation_type = 'family'
            and kinavela_private.can_access_family_conversation(
              conversation.id, true
            )
          )
          or (
            conversation.conversation_type = 'village'
            and conversation.village_id = new.target_village_id
            and kinavela_private.is_village_family_member(
              conversation.village_id, new.reporter_family_id, false
            )
          )
        )
    ) then raise exception 'report_target_not_available'; end if;
  elsif new.target_type = 'event' then
    if new.target_event_id is null or new.target_village_id is null
      or new.target_family_id is not null or new.target_message_id is not null
      or new.conversation_id is not null or not exists (
        select 1
        from public.events event
        where event.id = new.target_event_id
          and event.village_id = new.target_village_id
          and event.creator_family_id <> new.reporter_family_id
          and kinavela_private.is_village_family_member(
            event.village_id, new.reporter_family_id, false
          )
      ) then raise exception 'report_target_not_available'; end if;
  else
    raise exception 'invalid_report_target';
  end if;
  return new;
end;
$$;

revoke all on function kinavela_private.enforce_report_insert()
  from public, anon, authenticated, service_role;

insert into kinavela_private.schema_migrations(version)
values ('202608130008_event_report_insert_guard');

notify pgrst, 'reload schema';
commit;
