begin;

do $$
begin
  if exists (
    select 1
    from pg_class relation
    join pg_namespace schema on schema.oid = relation.relnamespace
    where schema.nspname = 'public'
      and relation.relkind = 'r'
      and (not relation.relrowsecurity or not relation.relforcerowsecurity)
  ) then
    raise exception 'public tables must use forced RLS';
  end if;
  if exists (select 1 from storage.buckets where public) then
    raise exception 'storage buckets must be private';
  end if;
  if has_table_privilege('anon', 'public.personal_data_exports', 'select') then
    raise exception 'anonymous export access exists';
  end if;
  if has_table_privilege('authenticated', 'public.personal_data_exports', 'select') then
    raise exception 'authenticated direct export access exists';
  end if;
  if has_function_privilege('anon', 'public.admin_list_users(integer)', 'execute') then
    raise exception 'anonymous admin RPC access exists';
  end if;
  if has_function_privilege('authenticated', 'public.get_personal_data_export_payload(uuid)', 'execute') then
    raise exception 'authenticated sensitive export RPC access exists';
  end if;
end $$;

rollback;
