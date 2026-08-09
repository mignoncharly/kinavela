do $$
declare
  rls_enabled boolean;
  rls_forced boolean;
begin
  if not exists (select 1 from pg_extension where extname = 'postgis') then
    raise exception 'PostGIS extension is missing';
  end if;

  select relrowsecurity, relforcerowsecurity
    into rls_enabled, rls_forced
  from pg_class
  where oid = 'public.system_status'::regclass;

  if not rls_enabled or not rls_forced then
    raise exception 'RLS must be enabled and forced on public.system_status';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'system_status'
      and policyname = 'Public may read non-sensitive service status'
  ) then
    raise exception 'Expected system_status RLS policy is missing';
  end if;

  if public.healthcheck() is distinct from true then
    raise exception 'healthcheck() did not return true';
  end if;
end
$$;
