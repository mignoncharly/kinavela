\set ON_ERROR_STOP on
begin;

do $$
declare
  result_signature text;
  function_definition text;
begin
  select pg_get_function_result(
    'public.claim_notification_deliveries()'::regprocedure
  ) into result_signature;

  if result_signature not ilike '%recipient_profile_id uuid%' then
    raise exception 'Notification delivery claims must include recipient profile id';
  end if;
  if result_signature not ilike '%channel_enabled boolean%' then
    raise exception 'Notification delivery claims must enforce channel rollout';
  end if;

  select pg_get_functiondef(
    'public.claim_notification_deliveries()'::regprocedure
  ) into function_definition;
  if function_definition not ilike '%profile.preferred_language::text%' then
    raise exception 'Notification delivery locale must match the declared text result type';
  end if;

  if result_signature ~* '(endpoint|p256dh|auth)' then
    raise exception 'Notification delivery claims must not expose push secrets';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.claim_notification_deliveries()',
    'execute'
  ) then
    raise exception 'Authenticated users must not claim notification deliveries';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.claim_notification_deliveries()',
    'execute'
  ) then
    raise exception 'Notification delivery worker grant is missing';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'notification_push_subscriptions'
      and column_name = 'failure_count'
      and is_nullable = 'NO'
  ) then
    raise exception 'Push delivery health columns are missing';
  end if;
end
$$;

rollback;
