\set ON_ERROR_STOP on
begin;

do $$
declare forced_rls_count integer;
begin
  select count(*) into forced_rls_count
  from pg_class relation
  join pg_namespace namespace on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relname in ('notification_preferences', 'notification_push_subscriptions', 'notification_events', 'notification_outbox')
    and relation.relrowsecurity and relation.relforcerowsecurity;
  if forced_rls_count <> 4 then raise exception 'Notification tables must use forced RLS'; end if;
end
$$;

do $$
begin
  if has_table_privilege('anon', 'public.notification_outbox', 'select')
     or has_table_privilege('authenticated', 'public.notification_outbox', 'select')
     or has_table_privilege('authenticated', 'public.notification_push_subscriptions', 'select') then
    raise exception 'Notification internals must remain RPC-only';
  end if;
  if not has_function_privilege('authenticated', 'public.list_notification_feed(integer)', 'execute')
     or not has_function_privilege('authenticated', 'public.update_notification_preferences(boolean,boolean)', 'execute')
     or not has_function_privilege('authenticated', 'public.register_notification_push_subscription(text,text,text)', 'execute') then
    raise exception 'Authenticated notification grants are missing';
  end if;
  if has_function_privilege('anon', 'public.list_notification_feed(integer)', 'execute')
     or has_function_privilege('authenticated', 'public.claim_notification_deliveries()', 'execute')
     or has_function_privilege('authenticated', 'public.complete_notification_delivery(uuid,text,text)', 'execute') then
    raise exception 'Notification worker grants are too broad';
  end if;
  if not has_function_privilege('service_role', 'public.claim_notification_deliveries()', 'execute')
     or not has_function_privilege('service_role', 'public.complete_notification_delivery(uuid,text,text)', 'execute') then
    raise exception 'Notification worker grants are missing';
  end if;
end
$$;

do $$
begin
  if pg_get_function_result('public.list_notification_feed(integer)'::regprocedure) ~* '(email|endpoint|p256dh|auth|actor_family_id)' then
    raise exception 'Notification feed exposes delivery or identity internals';
  end if;
  if pg_get_function_result('public.get_notification_preferences()'::regprocedure) ~* '(endpoint|p256dh|auth)' then
    raise exception 'Notification preference projection exposes subscription secrets';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'stories_enqueue_channels')
     or not exists (select 1 from pg_trigger where tgname = 'event_reminders_enqueue_channels')
     or not exists (select 1 from pg_trigger where tgname = 'village_messages_enqueue_channels') then
    raise exception 'Notification activity triggers are missing';
  end if;
end
$$;

rollback;
