\set ON_ERROR_STOP on
begin;

do $$
declare source text; result_type text;
begin
  if to_regprocedure('kinavela_private.pilot_city_key(text)') is not null
    or to_regprocedure('kinavela_private.regional_city_key(text)') is null
    or to_regprocedure('kinavela_private.capture_pilot_audit_event()') is not null
    or to_regprocedure('kinavela_private.capture_product_event()') is null
    or to_regprocedure('kinavela_private.enforce_pilot_location(text,text)') is not null
    or to_regprocedure('kinavela_private.enforce_pilot_family_limit()') is not null
    or exists (
      select 1 from pg_trigger
      where not tgisinternal and tgname = 'families_enforce_pilot_limit'
    ) then raise exception 'Legacy admission enforcement still exists'; end if;

  if to_regprocedure('public.admin_set_pilot_region_status(text,text,text)') is not null
    or to_regprocedure('public.admin_list_pilot_metrics(timestamp with time zone)') is not null
    or to_regprocedure('public.admin_list_regional_density()') is not null
  then raise exception 'Obsolete pilot admin contracts still exist'; end if;

  if to_regclass('kinavela_private.legacy_waitlist_archive') is null
    or to_regclass('kinavela_private.regional_interest_history') is null
  then raise exception 'Legacy waitlist archive or aggregate history is missing'; end if;

  if has_table_privilege('authenticated',
      'kinavela_private.legacy_waitlist_archive','select')
    or has_table_privilege('anon',
      'kinavela_private.regional_interest_history','select')
  then raise exception 'Legacy migration data is exposed to browser roles'; end if;

  if not has_function_privilege('authenticated',
      'public.admin_list_product_metrics(timestamp with time zone)','execute')
    or not has_function_privilege('authenticated',
      'public.admin_list_regional_outreach()','execute')
    or has_function_privilege('authenticated',
      'public.purge_legacy_pilot_data()','execute')
    or not has_function_privilege('service_role',
      'public.purge_legacy_pilot_data()','execute')
  then raise exception 'Phase 14 function grants are incorrect'; end if;

  select pg_get_function_result(
    'public.admin_list_regional_outreach()'::regprocedure
  ) into result_type;
  if result_type ~* '(waiting|threshold|rollout|status|profile_id)'
    or result_type not like '%historical_interest_count%'
  then raise exception 'Regional outreach projection retains admission semantics'; end if;

  select pg_get_functiondef('public.purge_legacy_pilot_data()'::regprocedure)
  into source;
  if source not like '%retained_until < now()%'
    or source not like '%service_role_required%'
  then raise exception 'Legacy rollback retention is not bounded'; end if;

  if not exists (
    select 1 from kinavela_private.retention_policies
    where policy_key = 'legacy_waitlist_archive' and retention_days = 180
  ) then raise exception 'Legacy archive retention policy is missing'; end if;

  if not exists (
    select 1 from pg_constraint constraint_row
    where constraint_row.conname = 'notification_events_notification_kind_check'
      and pg_get_constraintdef(constraint_row.oid) like '%germany_access_opened%'
  ) then raise exception 'Germany access notification is not typed'; end if;
end
$$;

rollback;
