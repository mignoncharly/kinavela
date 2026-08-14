\set ON_ERROR_STOP on
begin;

do $$
declare function_source text;
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'kinavela_private' and table_name = 'onboarding_drafts'
  ) then raise exception 'Private onboarding draft storage is missing'; end if;

  if has_table_privilege('authenticated', 'kinavela_private.onboarding_drafts', 'select')
    or has_table_privilege('authenticated', 'kinavela_private.onboarding_drafts', 'insert')
  then raise exception 'Onboarding drafts must not be directly accessible'; end if;

  if not has_function_privilege('authenticated', 'public.get_my_onboarding_draft()', 'execute')
    or not has_function_privilege('authenticated', 'public.save_my_onboarding_draft(jsonb)', 'execute')
    or not has_function_privilege('authenticated', 'public.delete_my_onboarding_draft()', 'execute')
    or has_function_privilege('anon', 'public.get_my_onboarding_draft()', 'execute')
  then raise exception 'Onboarding draft function grants are incorrect'; end if;

  select pg_get_functiondef('public.save_my_onboarding_draft(jsonb)'::regprocedure)
  into function_source;
  if function_source not like '%32768%'
    or function_source not like '%jsonb_object_keys%'
    or function_source not like '%current_profile_id%'
  then raise exception 'Onboarding draft privacy bounds are incomplete'; end if;
end
$$;

rollback;
