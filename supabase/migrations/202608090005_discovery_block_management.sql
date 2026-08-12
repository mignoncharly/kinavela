begin;

create or replace function public.list_discovery_blocks()
returns table (
  family_id uuid,
  family_name text,
  blocked_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select target.id, target.name, block.created_at
  from public.discovery_blocks block
  join public.families target on target.id = block.blocked_family_id
  join public.family_members membership on membership.family_id = block.blocker_family_id
  where membership.profile_id = public.current_profile_id()
    and membership.role = 'owner'
    and membership.status = 'active'
  order by block.created_at desc, target.id;
$$;

revoke all on function public.list_discovery_blocks()
  from public, anon, authenticated, service_role;
grant execute on function public.list_discovery_blocks() to authenticated;

insert into kinavela_private.schema_migrations(version)
values ('202608090005_discovery_block_management')
on conflict (version) do nothing;

notify pgrst, 'reload schema';
commit;
