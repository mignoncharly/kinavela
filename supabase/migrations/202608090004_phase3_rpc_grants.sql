begin;

-- Supabase-managed default grants add explicit EXECUTE privileges to API roles
-- when functions are created. Reset each Phase 3 RPC to its least-privilege role.
revoke all on function public.consume_geocoding_rate_limit(text, integer, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.claim_geocoding_provider_slot()
  from public, anon, authenticated, service_role;
revoke all on function public.complete_family_onboarding_with_location(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.set_family_location(text, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.set_discovery_block(uuid, boolean)
  from public, anon, authenticated, service_role;
revoke all on function public.discover_families(integer, uuid[], uuid[], uuid[], integer, integer, integer, integer)
  from public, anon, authenticated, service_role;

grant execute on function public.consume_geocoding_rate_limit(text, integer, integer),
  public.claim_geocoding_provider_slot() to service_role;
grant execute on function public.complete_family_onboarding_with_location(jsonb),
  public.set_family_location(text, integer),
  public.set_discovery_block(uuid, boolean),
  public.discover_families(integer, uuid[], uuid[], uuid[], integer, integer, integer, integer)
  to authenticated;

insert into kinavela_private.schema_migrations(version)
values ('202608090004_phase3_rpc_grants')
on conflict (version) do nothing;

notify pgrst, 'reload schema';
commit;
