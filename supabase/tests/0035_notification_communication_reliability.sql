\set ON_ERROR_STOP on
begin;

do $$
declare
  missing_columns integer;
  function_source text;
begin
  select count(*) into missing_columns
  from (values
    ('community_enabled'),('events_enabled'),('direct_enabled'),
    ('heritage_enabled'),('safety_enabled')
  ) expected(column_name)
  where not exists (
    select 1 from information_schema.columns column_info
    where column_info.table_schema='public'
      and column_info.table_name='notification_preferences'
      and column_info.column_name=expected.column_name
      and column_info.is_nullable='NO'
  );
  if missing_columns<>0 then
    raise exception 'Notification category preferences are incomplete';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='notification_outbox'
      and column_name='claimed_at'
  ) then raise exception 'Notification claims require a lease timestamp'; end if;

  select pg_get_functiondef(
    'kinavela_private.enqueue_notification(uuid,text,text,uuid,jsonb,timestamptz)'::regprocedure
  ) into function_source;
  if function_source not like '%notification_payload_is_safe%'
     or function_source not like '%community_enabled%'
     or function_source not like '%support_response%' then
    raise exception 'Notification enqueue must enforce privacy, mutes, and normalized kinds';
  end if;

  select pg_get_functiondef(
    'public.complete_notification_delivery(uuid,text,text)'::regprocedure
  ) into function_source;
  if function_source not like '%delivery.attempts%5%'
     or function_source not like '%status%queued%'
     or function_source not like '%scheduled_at%' then
    raise exception 'Failed notification delivery must retry with a bounded delay';
  end if;

  select pg_get_functiondef('public.claim_notification_deliveries()'::regprocedure)
    into function_source;
  if function_source not like '%claimed_at < now()%'
     or function_source like '%created_at < now() -%15 minutes%' then
    raise exception 'Notification worker leases must use claim time, not row age';
  end if;
  if function_source not like '%preferences.email_enabled%'
     or function_source not like '%consent.revoked_at is null%'
     or function_source not like '%preferences.push_enabled%'
     or function_source not like '%web_push_delivery%' then
    raise exception 'Claim-time preference, consent, and flag checks are incomplete';
  end if;
end
$$;

do $$
declare trigger_count integer;
begin
  select count(*) into trigger_count from pg_trigger
  where not tgisinternal and tgname in (
    'invitation_claims_notify_creator','village_members_notify_activity',
    'events_notify_invitation','event_attendees_notify_rsvp',
    'playdates_notify_proposal','reports_notify_resolution',
    'event_reminders_enqueue_channels','stories_enqueue_channels'
  );
  if trigger_count<>8 then
    raise exception 'Phase 12 activity notification triggers are incomplete';
  end if;
  if has_function_privilege(
    'authenticated','public.claim_notification_deliveries()','execute'
  ) or not has_function_privilege(
    'service_role','public.claim_notification_deliveries()','execute'
  ) then raise exception 'Notification worker grants are incorrect'; end if;
  if not has_function_privilege(
    'authenticated',
    'public.update_notification_preferences_v2(boolean,boolean,boolean,boolean,boolean,boolean,boolean)',
    'execute'
  ) then raise exception 'Notification mute preferences are unavailable'; end if;
  if not exists (
    select 1 from pg_trigger
    where not tgisinternal and tgname='notification_outbox_enforce_mute'
  ) then raise exception 'Conversation mute must suppress Village delivery'; end if;
end
$$;

do $$
begin
  if kinavela_private.notification_payload_is_safe(
    '{"exact_address":"private"}'::jsonb
  ) or kinavela_private.notification_payload_is_safe(
    '{"transcript_original":"private"}'::jsonb
  ) or not kinavela_private.notification_payload_is_safe(
    '{"village_id":"00000000-0000-4000-8000-000000000001"}'::jsonb
  ) then raise exception 'Notification payload privacy policy is incorrect'; end if;
end
$$;

rollback;
