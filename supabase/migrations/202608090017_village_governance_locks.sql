begin;

create or replace function public.set_village_member_role(
  p_village_id uuid,
  p_family_id uuid,
  p_role text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_uuid uuid := public.current_profile_id();
  family_uuid uuid := kinavela_private.current_family_id(false);
  actor_membership_role text;
  target_membership_role text;
begin
  if profile_uuid is null or family_uuid is null then raise exception 'not_authorized'; end if;
  if p_role not in ('owner', 'organizer', 'moderator', 'member') then raise exception 'invalid_role'; end if;
  perform 1 from public.villages where id = p_village_id and status = 'active' for update;
  if not found then raise exception 'village_not_available'; end if;
  select vm.role into actor_membership_role from public.village_members vm
  where vm.village_id = p_village_id and vm.family_id = family_uuid and vm.status = 'active'
  for update;
  select vm.role into target_membership_role from public.village_members vm
  where vm.village_id = p_village_id and vm.family_id = p_family_id and vm.status = 'active'
  for update;
  if actor_membership_role <> 'owner' then raise exception 'not_authorized'; end if;
  if target_membership_role is null then raise exception 'member_not_available'; end if;
  if p_role = 'owner' then
    if p_family_id = family_uuid then return true; end if;
    update public.village_members set role = 'organizer'
    where village_id = p_village_id and family_id = family_uuid and role = 'owner' and status = 'active';
    update public.village_members set role = 'owner'
    where village_id = p_village_id and family_id = p_family_id and status = 'active';
    insert into public.village_moderation_actions(
      village_id, actor_profile_id, actor_family_id, action_type, target_family_id
    ) values (p_village_id, profile_uuid, family_uuid, 'ownership_transferred', p_family_id);
  else
    if p_family_id = family_uuid then raise exception 'owner_cannot_self_demote'; end if;
    if target_membership_role = 'owner' then raise exception 'member_not_available'; end if;
    update public.village_members set role = p_role
    where village_id = p_village_id and family_id = p_family_id and status = 'active';
    insert into public.village_moderation_actions(
      village_id, actor_profile_id, actor_family_id, action_type, target_family_id, metadata
    ) values (
      p_village_id, profile_uuid, family_uuid, 'role_changed', p_family_id,
      jsonb_build_object('role', p_role)
    );
  end if;
  return true;
end;
$$;

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
  perform 1 from public.villages where id = p_village_id and status = 'active' for update;
  if not found then raise exception 'village_not_available'; end if;
  select vm.role into membership_role from public.village_members vm
  where vm.village_id = p_village_id and vm.family_id = family_uuid and vm.status = 'active'
  for update;
  if membership_role is null then raise exception 'membership_not_available'; end if;
  if membership_role = 'owner' then raise exception 'transfer_ownership_required'; end if;
  update public.village_members set status = 'removed', responded_at = now()
  where village_id = p_village_id and family_id = family_uuid and status = 'active';
  delete from public.conversation_participants cp using public.conversations c
  where cp.conversation_id = c.id and c.village_id = p_village_id and cp.family_id = family_uuid;
  insert into public.village_moderation_actions(
    village_id, actor_profile_id, actor_family_id, action_type, target_family_id
  ) values (p_village_id, profile_uuid, family_uuid, 'member_left', family_uuid);
  return true;
end;
$$;

create or replace function public.remove_village_member(
  p_village_id uuid,
  p_family_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_uuid uuid := public.current_profile_id();
  family_uuid uuid := kinavela_private.current_family_id(false);
  actor_membership_role text;
  target_membership_role text;
begin
  if profile_uuid is null or family_uuid is null then raise exception 'not_authorized'; end if;
  perform 1 from public.villages where id = p_village_id and status = 'active' for update;
  if not found then raise exception 'village_not_available'; end if;
  select vm.role into actor_membership_role from public.village_members vm
  where vm.village_id = p_village_id and vm.family_id = family_uuid and vm.status = 'active'
  for update;
  select vm.role into target_membership_role from public.village_members vm
  where vm.village_id = p_village_id and vm.family_id = p_family_id and vm.status = 'active'
  for update;
  if actor_membership_role not in ('owner', 'organizer', 'moderator')
     or target_membership_role is null or target_membership_role = 'owner'
     or p_family_id = family_uuid then raise exception 'not_authorized'; end if;
  if actor_membership_role <> 'owner' and target_membership_role <> 'member' then
    raise exception 'not_authorized';
  end if;
  update public.village_members set status = 'removed', responded_at = now()
  where village_id = p_village_id and family_id = p_family_id and status = 'active';
  delete from public.conversation_participants cp using public.conversations c
  where cp.conversation_id = c.id and c.village_id = p_village_id and cp.family_id = p_family_id;
  insert into public.village_moderation_actions(
    village_id, actor_profile_id, actor_family_id, action_type, target_family_id
  ) values (p_village_id, profile_uuid, family_uuid, 'member_removed', p_family_id);
  insert into public.audit_events(actor_profile_id, event_type, entity_type, entity_id, metadata)
  values (
    profile_uuid, 'member_removed', 'village', p_village_id,
    jsonb_build_object('target_family_id', p_family_id)
  );
  return true;
end;
$$;

revoke all on function public.set_village_member_role(uuid, uuid, text),
  public.leave_village(uuid), public.remove_village_member(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.set_village_member_role(uuid, uuid, text),
  public.leave_village(uuid), public.remove_village_member(uuid, uuid)
  to authenticated;

insert into kinavela_private.schema_migrations(version)
values ('202608090017_village_governance_locks')
on conflict(version) do nothing;

notify pgrst, 'reload schema';
commit;
