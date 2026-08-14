begin;

create or replace function public.accept_village_invitation_link(p_token text)
returns table(village_id uuid, event_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_uuid uuid := public.current_profile_id();
  family_uuid uuid := kinavela_private.current_family_id(true);
  link_row public.invitation_links%rowtype;
  village_row public.villages%rowtype;
begin
  if profile_uuid is null or family_uuid is null then raise exception 'owner_required'; end if;
  select * into link_row from public.invitation_links link
  where link.token_digest = kinavela_private.invitation_digest(p_token)
    and p_token ~ '^[A-Za-z0-9_-]{43}$'
    and link.invitation_kind = 'village'
    and link.revoked_at is null and link.expires_at > now()
    and link.claim_count < link.max_claims
  for update;
  if link_row.id is null then raise exception 'invitation_not_available'; end if;

  select * into village_row from public.villages village
  where village.id = link_row.village_id and village.status = 'active'
  for update;
  if village_row.id is null then raise exception 'village_not_available'; end if;
  if link_row.event_id is not null and not exists (
    select 1 from public.events event where event.id = link_row.event_id
      and event.village_id = village_row.id and event.status = 'scheduled'
  ) then raise exception 'event_not_available'; end if;

  if not exists (
    select 1 from public.families family
    where family.id = family_uuid and family.location is not null
      and extensions.st_dwithin(
        family.location, village_row.center_location,
        least(family.discovery_radius_km, village_row.radius_km) * 1000.0
      )
  ) then raise exception 'geographic_eligibility_required'; end if;
  if exists (
    select 1 from public.village_members member
    join public.discovery_blocks block on (
      (block.blocker_family_id = family_uuid and block.blocked_family_id = member.family_id)
      or (block.blocked_family_id = family_uuid and block.blocker_family_id = member.family_id)
    ) where member.village_id = village_row.id and member.status = 'active'
  ) then raise exception 'village_not_available'; end if;
  if exists (
    select 1 from public.village_members member
    where member.village_id = village_row.id and member.family_id = family_uuid
      and member.status = 'active'
  ) then raise exception 'membership_already_exists'; end if;

  insert into public.village_members(
    village_id, family_id, role, status, initiated_by_family_id
  ) values (
    village_row.id, family_uuid, 'member', 'invited', link_row.created_by_family_id
  ) on conflict on constraint village_members_village_id_family_id_key do update
    set role = 'member', status = 'invited',
        initiated_by_family_id = link_row.created_by_family_id,
        joined_at = null, responded_at = null, updated_at = now()
    where public.village_members.status in ('requested', 'invited', 'declined', 'removed');
  if not found then raise exception 'membership_already_exists'; end if;

  perform kinavela_private.activate_village_family(village_row.id, family_uuid);
  insert into public.invitation_claims(
    invitation_link_id, claimed_by_profile_id, claimed_by_family_id, outcome
  ) values (link_row.id, profile_uuid, family_uuid, 'village_joined');
  update public.invitation_links set claim_count = claim_count + 1
  where id = link_row.id;
  insert into public.village_moderation_actions(
    village_id, actor_profile_id, actor_family_id, action_type,
    target_family_id, metadata
  ) values (
    village_row.id, profile_uuid, family_uuid, 'invite_accepted',
    family_uuid, jsonb_build_object('invitation_link_id', link_row.id)
  );
  insert into public.audit_events(
    actor_profile_id, event_type, entity_type, entity_id,
    metadata
  ) values (
    profile_uuid, 'invitation_link_claimed', 'invitation_link', link_row.id,
    jsonb_build_object('kind', 'village', 'has_event', link_row.event_id is not null)
  );
  return query select village_row.id, link_row.event_id;
end;
$$;

revoke all on function public.accept_village_invitation_link(text)
from public, anon, authenticated, service_role;
grant execute on function public.accept_village_invitation_link(text)
to authenticated;

insert into kinavela_private.schema_migrations(version)
values ('202608130005_invitation_acceptance_conflict');

select pg_notify('pgrst', 'reload schema');

commit;
