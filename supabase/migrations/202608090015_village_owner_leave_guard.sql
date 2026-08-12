begin;

create or replace function public.leave_village(p_village_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_uuid uuid := public.current_profile_id();
  family_uuid uuid := kinavela_private.current_family_id(true);
  membership_role text;
begin
  if profile_uuid is null or family_uuid is null then raise exception 'not_authorized'; end if;
  select vm.role into membership_role
  from public.village_members vm
  where vm.village_id = p_village_id
    and vm.family_id = family_uuid
    and vm.status = 'active'
  for update;
  if membership_role is null then raise exception 'membership_not_available'; end if;
  if membership_role = 'owner' then raise exception 'transfer_ownership_required'; end if;
  update public.village_members
  set status = 'removed', responded_at = now()
  where village_id = p_village_id and family_id = family_uuid;
  delete from public.conversation_participants cp
  using public.conversations c
  where cp.conversation_id = c.id
    and c.village_id = p_village_id
    and cp.family_id = family_uuid;
  insert into public.village_moderation_actions(
    village_id, actor_profile_id, actor_family_id, action_type, target_family_id
  ) values (p_village_id, profile_uuid, family_uuid, 'member_left', family_uuid);
  return true;
end;
$$;

revoke all on function public.leave_village(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.leave_village(uuid) to authenticated;

insert into kinavela_private.schema_migrations(version)
values ('202608090015_village_owner_leave_guard')
on conflict(version) do nothing;

notify pgrst, 'reload schema';
commit;
