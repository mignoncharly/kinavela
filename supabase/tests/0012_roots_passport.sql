\set ON_ERROR_STOP on
begin;

do $$
begin
  if not exists (
    select 1
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in ('roots_passports', 'roots_passport_entries', 'roots_passport_exports')
    group by namespace.nspname
    having count(*) = 3 and bool_and(relation.relrowsecurity and relation.relforcerowsecurity)
  ) then raise exception 'Roots Passport tables must use forced RLS'; end if;
  if has_table_privilege('authenticated', 'public.roots_passport_entries', 'select')
     or has_table_privilege('authenticated', 'public.roots_passport_entries', 'insert') then
    raise exception 'Roots entries must remain RPC-only';
  end if;
  if has_function_privilege('anon', 'public.list_my_roots_passports()', 'execute')
     or has_function_privilege('authenticated', 'kinavela_private.can_manage_roots_passport(uuid)', 'execute') then
    raise exception 'Roots Passport authorization grants are too broad';
  end if;
  if pg_get_function_result('public.list_roots_passport_entries(uuid)'::regprocedure)
       ~* '(birth_year|birth_month|email|media_path|coordinate|longitude|latitude)' then
    raise exception 'Roots entry projection exposes sensitive fields';
  end if;
  if exists (select 1 from storage.buckets where id = 'roots-media' and public) then
    raise exception 'Roots media bucket must remain private';
  end if;
end
$$;

rollback;
