begin;

drop policy "Authorized members read messages" on public.messages;
create policy "Authorized members read messages"
  on public.messages for select to authenticated
  using (
    deleted_at is null
    and (
      public.can_access_family_conversation(conversation_id)
      or public.can_access_village_conversation(conversation_id)
    )
  );

create or replace function public.resolve_village_report(
  p_report_id uuid,
  p_resolution text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_uuid uuid := public.current_profile_id();
  family_uuid uuid := kinavela_private.current_family_id(false);
  report_row public.reports%rowtype;
  target_role text;
begin
  if p_resolution not in ('dismiss', 'delete_message', 'remove_member') then raise exception 'invalid_resolution'; end if;
  select * into report_row from public.reports
  where id = p_report_id and status in ('open', 'reviewing') for update;
  if report_row.id is null or report_row.target_village_id is null
     or not kinavela_private.can_access_village(report_row.target_village_id, true) then
    raise exception 'report_not_available';
  end if;
  if p_resolution = 'delete_message' then
    if report_row.target_message_id is null then raise exception 'invalid_resolution'; end if;
    update public.messages set deleted_at = now()
    where id = report_row.target_message_id
      and conversation_id = report_row.conversation_id
      and deleted_at is null;
    if not found then raise exception 'message_not_available'; end if;
    insert into public.village_moderation_actions(
      village_id, actor_profile_id, actor_family_id, action_type,
      target_family_id, target_message_id, report_id
    ) values (
      report_row.target_village_id, profile_uuid, family_uuid, 'message_removed',
      report_row.target_family_id, report_row.target_message_id, report_row.id
    );
  elsif p_resolution = 'remove_member' then
    if report_row.target_family_id is null then raise exception 'invalid_resolution'; end if;
    select role into target_role from public.village_members
    where village_id = report_row.target_village_id
      and family_id = report_row.target_family_id
      and status = 'active';
    if target_role is null or target_role = 'owner' then raise exception 'not_authorized'; end if;
    perform public.remove_village_member(report_row.target_village_id, report_row.target_family_id);
  else
    insert into public.village_moderation_actions(
      village_id, actor_profile_id, actor_family_id, action_type,
      target_family_id, target_message_id, report_id
    ) values (
      report_row.target_village_id, profile_uuid, family_uuid, 'report_dismissed',
      report_row.target_family_id, report_row.target_message_id, report_row.id
    );
  end if;
  update public.reports
  set status = case when p_resolution = 'dismiss' then 'dismissed' else 'resolved' end
  where id = report_row.id;
  return true;
end;
$$;

revoke all on function public.resolve_village_report(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.resolve_village_report(uuid, text) to authenticated;

insert into kinavela_private.schema_migrations(version)
values ('202608090016_village_message_tombstones')
on conflict(version) do nothing;

notify pgrst, 'reload schema';
commit;
