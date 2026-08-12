\set ON_ERROR_STOP on
begin;

do $$
begin
  if not exists (
    select 1
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in ('cultural_missions', 'mission_steps', 'village_missions', 'family_mission_progress')
    group by namespace.nspname
    having count(*) = 4 and bool_and(relation.relrowsecurity and relation.relforcerowsecurity)
  ) then
    raise exception 'Every Phase 10 mission table must use forced RLS';
  end if;
  if has_table_privilege('authenticated', 'public.family_mission_progress', 'select')
     or has_table_privilege('authenticated', 'public.family_mission_progress', 'insert') then
    raise exception 'Family mission progress must remain RPC-only';
  end if;
  if has_function_privilege('anon', 'public.list_cultural_missions()', 'execute')
     or has_function_privilege('anon', 'public.start_cultural_mission(uuid,uuid)', 'execute')
     or has_function_privilege('authenticated', 'kinavela_private.can_manage_mission_family(uuid)', 'execute') then
    raise exception 'Mission authorization grants are too broad';
  end if;
  if pg_get_function_result('public.list_cultural_missions()'::regprocedure)
       ~* '(child_id|child_name|email|location|coordinate|longitude|latitude)' then
    raise exception 'Mission catalogue projection exposes private family or child data';
  end if;
end
$$;

rollback;
