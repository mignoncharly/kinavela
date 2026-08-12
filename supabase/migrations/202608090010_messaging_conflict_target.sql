begin;

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

revoke all on function public.list_family_conversations()
  from public, anon, authenticated, service_role;
grant execute on function public.list_family_conversations() to authenticated;

insert into kinavela_private.schema_migrations(version)
values ('202608090010_messaging_conflict_target')
on conflict (version) do nothing;

notify pgrst, 'reload schema';
commit;
