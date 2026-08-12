\set ON_ERROR_STOP on
begin;

do $$
declare forced_rls_count integer;
begin
  select count(*) into forced_rls_count
  from pg_class relation
  join pg_namespace namespace on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relname in ('billing_customers', 'subscriptions', 'subscription_events')
    and relation.relrowsecurity and relation.relforcerowsecurity;
  if forced_rls_count <> 3 then
    raise exception 'Billing tables must use forced RLS';
  end if;
end
$$;

do $$
begin
  if has_table_privilege('anon', 'public.billing_customers', 'select')
     or has_table_privilege('authenticated', 'public.billing_customers', 'select')
     or has_table_privilege('authenticated', 'public.subscriptions', 'select')
     or has_table_privilege('authenticated', 'public.subscription_events', 'select') then
    raise exception 'Billing internals must remain RPC-only';
  end if;
  if not has_function_privilege(
       'authenticated', 'public.get_my_entitlements()', 'execute'
     )
     or not has_function_privilege(
       'service_role',
       'public.sync_billing_subscription(uuid,text,text,text,text,text,text,timestamptz,timestamptz,boolean,timestamptz)',
       'execute'
     )
     or not has_function_privilege(
       'service_role',
       'public.record_subscription_event(text,text,jsonb)', 'execute'
     )
     or not has_function_privilege(
       'service_role', 'public.complete_subscription_event(text)', 'execute'
     )
     or not has_function_privilege(
       'service_role', 'public.fail_subscription_event(text,text)', 'execute'
     ) then
    raise exception 'Billing RPC grants are missing';
  end if;
  if has_function_privilege(
       'anon', 'public.get_my_entitlements()', 'execute'
     )
     or has_function_privilege(
       'authenticated',
       'public.sync_billing_subscription(uuid,text,text,text,text,text,text,timestamptz,timestamptz,boolean,timestamptz)',
       'execute'
     ) then
    raise exception 'Billing RPC grants are too broad';
  end if;
end
$$;

do $$
declare entitlement_result text;
begin
  select pg_get_function_result('public.get_my_entitlements()'::regprocedure)
    into entitlement_result;
  if entitlement_result ~* '(stripe_customer_id|stripe_subscription_id|price_id|payload)' then
    raise exception 'Entitlement projection exposes Stripe internals';
  end if;
  if not exists (
    select 1 from kinavela_private.admin_feature_flags
    where flag_key = 'premium_billing'
  ) then
    raise exception 'Premium billing feature flag is missing';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'ai_jobs_premium_entitlement')
     or not exists (select 1 from pg_trigger where tgname = 'story_ai_jobs_premium_entitlement') then
    raise exception 'Premium AI entitlement guards are missing';
  end if;
end
$$;

rollback;

