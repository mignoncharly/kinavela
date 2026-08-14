begin;

do $$
begin
  if not exists (
    select 1
    from kinavela_private.pilot_settings
    where not enabled
  ) then
    raise exception 'legacy pilot admission configuration was not retired';
  end if;
  if to_regclass('public.pilot_waitlist') is null then
    raise exception 'historical waitlist records were not preserved';
  end if;
  if has_table_privilege('anon', 'public.pilot_waitlist', 'select')
     or has_table_privilege('authenticated', 'public.pilot_waitlist', 'select') then
    raise exception 'historical waitlist data is publicly accessible';
  end if;
  if has_function_privilege(
    'authenticated',
    'public.join_pilot_waitlist(text,text,text)',
    'execute'
  ) or has_function_privilege(
    'authenticated',
    'public.list_my_pilot_waitlist()',
    'execute'
  ) then
    raise exception 'retired waitlist RPC is still available';
  end if;
  if has_function_privilege(
    'anon',
    'public.admin_list_product_metrics(timestamp with time zone)',
    'execute'
  ) then
    raise exception 'anonymous product metrics access exists';
  end if;
  if not has_function_privilege(
    'authenticated',
    'public.record_real_life_meeting(uuid)',
    'execute'
  ) then
    raise exception 'meeting confirmation RPC missing';
  end if;
end
$$;

rollback;
