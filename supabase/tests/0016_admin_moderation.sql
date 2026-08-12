\set ON_ERROR_STOP on
begin;

do $$
declare
  forced_rls_count integer;
begin
  select count(*) into forced_rls_count
  from pg_class relation
  join pg_namespace namespace on namespace.oid = relation.relnamespace
  where namespace.nspname = 'kinavela_private'
    and relation.relname in ('admin_roles', 'admin_feature_flags')
    and relation.relrowsecurity and relation.relforcerowsecurity;
  if forced_rls_count <> 2 then raise exception 'Admin control tables must use forced RLS'; end if;
end
$$;

do $$
begin
  if has_table_privilege('anon', 'kinavela_private.admin_roles', 'select')
     or has_table_privilege('authenticated', 'kinavela_private.admin_roles', 'select')
     or has_table_privilege('service_role', 'kinavela_private.admin_feature_flags', 'select') then
    raise exception 'Admin control tables must remain private';
  end if;
  if has_function_privilege('authenticated', 'public.grant_admin_role(uuid,text)', 'execute')
     or has_function_privilege('anon', 'public.admin_list_reports(text,integer)', 'execute') then
    raise exception 'Admin grants are too broad';
  end if;
  if not has_function_privilege('authenticated', 'public.admin_list_reports(text,integer)', 'execute')
     or not has_function_privilege('authenticated', 'public.admin_suspend_profile(uuid,text)', 'execute')
     or not has_function_privilege('service_role', 'public.grant_admin_role(uuid,text)', 'execute') then
    raise exception 'Admin grants are missing';
  end if;
end
$$;

do $$
begin
  if pg_get_function_result('public.admin_list_users(integer)'::regprocedure) ~* '(auth_user_id|email|password)' then
    raise exception 'Admin user projection exposes auth internals';
  end if;
  if pg_get_function_result('public.admin_list_families(integer)'::regprocedure) ~* '(location|bio|child)' then
    raise exception 'Admin family projection exposes private details';
  end if;
  if pg_get_function_result('public.admin_list_villages(integer)'::regprocedure) ~* '(center_location|location)' then
    raise exception 'Admin village projection exposes exact location';
  end if;
  if pg_get_function_result('public.admin_list_events(integer)'::regprocedure) ~* '(address|description|location)' then
    raise exception 'Admin event projection exposes private location details';
  end if;
  if pg_get_function_result('public.admin_list_ai_jobs(integer)'::regprocedure) ~* '(input_context|output)' then
    raise exception 'Admin AI projection exposes raw AI content';
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from kinavela_private.admin_feature_flags where flag_key = 'web_push_delivery') then
    raise exception 'Default feature flags are missing';
  end if;
  if has_table_privilege('authenticated', 'public.profiles', 'update')
     or has_table_privilege('authenticated', 'public.reports', 'update') then
    raise exception 'Admin mutations must not use direct table updates';
  end if;
end
$$;

rollback;
