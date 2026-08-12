begin;

do $$
begin
  if not exists (select 1 from kinavela_private.pilot_settings where enabled and 50 = max_active_families and 'DE' = any(allowed_country_codes)) then raise exception 'pilot configuration is not Germany/50-family controlled'; end if;
  if (select count(*) from kinavela_private.pilot_regions where country_code = 'DE') < 8 then raise exception 'pilot regions incomplete'; end if;
  if not has_table_privilege('anon', 'public.pilot_waitlist', 'select') then null; else raise exception 'anonymous waitlist access exists'; end if;
  if has_table_privilege('authenticated', 'public.product_events', 'select') then raise exception 'authenticated direct metrics access exists'; end if;
  if has_function_privilege('anon', 'public.admin_list_pilot_metrics(timestamp with time zone)', 'execute') then raise exception 'anonymous pilot metrics access exists'; end if;
  if not has_function_privilege('authenticated', 'public.join_pilot_waitlist(text,text,text)', 'execute') then raise exception 'authenticated waitlist RPC missing'; end if;
  if not has_function_privilege('authenticated', 'public.record_real_life_meeting(uuid)', 'execute') then raise exception 'meeting confirmation RPC missing'; end if;
end $$;

rollback;
