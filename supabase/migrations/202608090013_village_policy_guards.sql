begin;

create or replace function public.can_moderate_village(p_village_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select kinavela_private.can_access_village(p_village_id, true)
$$;

revoke all on function public.can_moderate_village(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.can_moderate_village(uuid) to authenticated;

drop policy "Moderators read Village action log" on public.village_moderation_actions;
create policy "Moderators read Village action log"
  on public.village_moderation_actions for select to authenticated
  using (public.can_moderate_village(village_id));

create or replace function kinavela_private.activate_village_family(
  p_village_id uuid,
  p_family_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  conversation_uuid uuid;
begin
  perform 1 from public.villages
  where id = p_village_id and status = 'active'
  for update;
  if not found then raise exception 'village_not_available'; end if;
  if (select count(*) from public.village_members where village_id = p_village_id and status = 'active') >=
     (select member_limit from public.villages where id = p_village_id) then
    raise exception 'village_full';
  end if;
  if exists (
    select 1 from public.village_members other_vm
    join public.discovery_blocks db on (
      (db.blocker_family_id = p_family_id and db.blocked_family_id = other_vm.family_id)
      or (db.blocked_family_id = p_family_id and db.blocker_family_id = other_vm.family_id)
    )
    where other_vm.village_id = p_village_id and other_vm.status = 'active'
  ) then raise exception 'village_not_available'; end if;
  update public.village_members
  set status = 'active', joined_at = now(), responded_at = now()
  where village_id = p_village_id and family_id = p_family_id;
  if not found then raise exception 'membership_not_available'; end if;
  select id into conversation_uuid from public.conversations where village_id = p_village_id;
  insert into public.conversation_participants(conversation_id, family_id, profile_id)
  select conversation_uuid, fm.family_id, fm.profile_id
  from public.family_members fm
  join public.profiles p on p.id = fm.profile_id and p.status = 'active'
  where fm.family_id = p_family_id and fm.status = 'active'
  on conflict on constraint conversation_participants_conversation_id_profile_id_key do nothing;
end;
$$;

revoke all on function kinavela_private.activate_village_family(uuid, uuid)
  from public, anon, authenticated, service_role;

insert into kinavela_private.schema_migrations(version)
values ('202608090013_village_policy_guards')
on conflict(version) do nothing;

notify pgrst, 'reload schema';
commit;
