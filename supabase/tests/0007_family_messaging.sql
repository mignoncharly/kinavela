\set ON_ERROR_STOP on
begin;

do $$
declare
  table_name text;
  rls_enabled boolean;
  rls_forced boolean;
begin
  foreach table_name in array array[
    'conversations', 'conversation_participants', 'messages', 'reports'
  ] loop
    select relrowsecurity, relforcerowsecurity into rls_enabled, rls_forced
    from pg_class where oid = format('public.%I', table_name)::regclass;
    if not rls_enabled or not rls_forced then
      raise exception 'RLS is not enabled and forced on public.%', table_name;
    end if;
  end loop;
  if has_table_privilege('authenticated', 'public.messages', 'insert')
     or has_table_privilege('authenticated', 'public.messages', 'update')
     or has_table_privilege('authenticated', 'public.reports', 'insert')
     or has_table_privilege('authenticated', 'public.conversation_participants', 'update') then
    raise exception 'Messaging tables exceed least privilege.';
  end if;
  if has_function_privilege('anon', 'public.send_family_message(uuid,text,uuid)', 'execute')
     or has_function_privilege('anon', 'public.list_conversation_messages(uuid,timestamptz,integer)', 'execute')
     or has_function_privilege('anon', 'public.submit_report(text,uuid,text,text)', 'execute')
     or has_function_privilege('authenticated', 'kinavela_private.can_access_family_conversation(uuid,boolean)', 'execute')
     or has_function_privilege('authenticated', 'kinavela_private.enforce_message_insert()', 'execute')
     or has_function_privilege('authenticated', 'kinavela_private.enforce_report_insert()', 'execute') then
    raise exception 'Messaging function grants exceed least privilege.';
  end if;
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.messages'::regclass
      and tgname = 'messages_enforce_insert' and not tgisinternal
  ) or not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.reports'::regclass
      and tgname = 'reports_enforce_insert' and not tgisinternal
  ) then raise exception 'Messaging insert guards are missing.'; end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then raise exception 'Messages are not enabled for Realtime.'; end if;
  if pg_get_function_result('public.list_conversation_messages(uuid,timestamptz,integer)'::regprocedure)
     ~* '(email|auth_user|location|birth_year|avatar_path)' then
    raise exception 'Message projection exposes an unrelated sensitive field.';
  end if;
end
$$;

\set message_user_a 'a2aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
\set message_user_b 'b2bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
\set message_user_c 'c2cccccc-cccc-4ccc-8ccc-cccccccccccc'
\set message_family_a 'a2aaaaaa-1111-4111-8111-aaaaaaaaaaaa'
\set message_family_b 'b2bbbbbb-2222-4222-8222-bbbbbbbbbbbb'
\set message_family_c 'c2cccccc-3333-4333-8333-cccccccccccc'

insert into auth.users(id, email, raw_user_meta_data, is_sso_user, is_anonymous, created_at, updated_at)
values
  (:'message_user_a', 'message-a@kinavela.invalid', '{"display_name":"Messenger A"}', false, false, now(), now()),
  (:'message_user_b', 'message-b@kinavela.invalid', '{"display_name":"Messenger B"}', false, false, now(), now()),
  (:'message_user_c', 'message-c@kinavela.invalid', '{"display_name":"Messenger C"}', false, false, now(), now());

select id as message_profile_a from public.profiles where auth_user_id = :'message_user_a'::uuid \gset
select id as message_profile_b from public.profiles where auth_user_id = :'message_user_b'::uuid \gset
select id as message_profile_c from public.profiles where auth_user_id = :'message_user_c'::uuid \gset

insert into public.families(id, name, slug, created_by, country_of_residence, city)
values
  (:'message_family_a', 'Message Family A', 'message-family-a', :'message_profile_a', 'DE', 'Berlin'),
  (:'message_family_b', 'Message Family B', 'message-family-b', :'message_profile_b', 'DE', 'Potsdam'),
  (:'message_family_c', 'Message Family C', 'message-family-c', :'message_profile_c', 'DE', 'Berlin');

insert into public.family_members(family_id, profile_id, role, status)
values
  (:'message_family_a', :'message_profile_a', 'owner', 'active'),
  (:'message_family_b', :'message_profile_b', 'owner', 'active'),
  (:'message_family_c', :'message_profile_c', 'owner', 'active');

insert into public.family_connections(
  requester_family_id, recipient_family_id, status, status_changed_by_family_id,
  responded_at, accepted_at
)
values
  (:'message_family_a', :'message_family_b', 'accepted', :'message_family_b', now(), now()),
  (:'message_family_a', :'message_family_c', 'requested', :'message_family_a', null, null);

create function pg_temp.conversation_create_is_denied(p_family_id uuid)
returns boolean
language plpgsql
as $$
begin
  perform public.get_or_create_family_conversation(p_family_id);
  return false;
exception when others then return true;
end;
$$;

create function pg_temp.message_send_is_denied(p_conversation_id uuid)
returns boolean
language plpgsql
as $$
begin
  perform public.send_family_message(p_conversation_id, 'must not send', null);
  return false;
exception when others then return true;
end;
$$;

create function pg_temp.report_submit_is_denied(p_family_id uuid)
returns boolean
language plpgsql
as $$
begin
  perform public.submit_report('family', p_family_id, 'other', null);
  return false;
exception when others then return true;
end;
$$;

select set_config('request.jwt.claim.sub', :'message_user_a', true);
select set_config('request.jwt.claims', json_build_object('sub', :'message_user_a', 'role', 'authenticated')::text, true);
set local role authenticated;

select public.get_or_create_family_conversation(:'message_family_b'::uuid) as conversation_id \gset
select pg_temp.conversation_create_is_denied(:'message_family_c'::uuid)::integer as unaccepted_denied \gset
\if :unaccepted_denied
\else
  \echo 'Messaging failure: a conversation opened without an accepted connection.'
  select 1 / 0;
\endif

reset role;
update public.conversation_participants
set last_read_at = now() - interval '1 second'
where conversation_id = :'conversation_id'::uuid
  and profile_id = :'message_profile_b'::uuid;
select set_config('request.jwt.claim.sub', :'message_user_a', true);
select set_config('request.jwt.claims', json_build_object('sub', :'message_user_a', 'role', 'authenticated')::text, true);
set local role authenticated;

select public.send_family_message(:'conversation_id'::uuid, '  Hello from Family A  ', null) as first_message_id \gset
select count(*)::integer as own_message_count
from public.list_conversation_messages(:'conversation_id'::uuid, null, 50)
where message_id = :'first_message_id'::uuid
  and body = 'Hello from Family A'
  and sender_display_name = 'Messenger A'
  and is_own_family \gset
\if :own_message_count
\else
  \echo 'Messaging failure: sender cannot read the normalized message projection.'
  select 1 / 0;
\endif

reset role;
select set_config('request.jwt.claim.sub', :'message_user_b', true);
select set_config('request.jwt.claims', json_build_object('sub', :'message_user_b', 'role', 'authenticated')::text, true);
set local role authenticated;

select count(*)::integer as unread_conversation_count
from public.list_family_conversations()
where conversation_id = :'conversation_id'::uuid
  and other_family_id = :'message_family_a'::uuid
  and unread_count = 1
  and not muted \gset
select public.get_unread_message_count() as unread_total \gset
select count(*)::integer as message_notification_count
from public.list_notifications(30)
where notification_type = 'message_received'
  and actor_family_id = :'message_family_a'::uuid \gset
select (:unread_conversation_count = 1 and :unread_total = 1 and :message_notification_count = 1)::integer as unread_valid \gset
\if :unread_valid
\else
  \echo 'Messaging failure: unread or message notification state is incorrect.' :unread_conversation_count :unread_total :message_notification_count
  select 1 / 0;
\endif

select public.mark_conversation_read(:'conversation_id'::uuid);
select public.get_unread_message_count() as unread_after_read \gset
select public.set_conversation_muted(:'conversation_id'::uuid, true);

reset role;
update public.messages
set created_at = now() - interval '2 seconds'
where id = :'first_message_id'::uuid;
update public.conversation_participants
set last_read_at = now() - interval '1 second'
where conversation_id = :'conversation_id'::uuid
  and profile_id = :'message_profile_b'::uuid;
select set_config('request.jwt.claim.sub', :'message_user_a', true);
select set_config('request.jwt.claims', json_build_object('sub', :'message_user_a', 'role', 'authenticated')::text, true);
set local role authenticated;
select public.send_family_message(:'conversation_id'::uuid, 'Second message', :'first_message_id'::uuid) as second_message_id \gset

reset role;
select set_config('request.jwt.claim.sub', :'message_user_b', true);
select set_config('request.jwt.claims', json_build_object('sub', :'message_user_b', 'role', 'authenticated')::text, true);
set local role authenticated;
select public.get_unread_message_count() as muted_unread_total \gset
select count(*)::integer as muted_notification_count
from public.list_notifications(30)
where notification_type = 'message_received' \gset
select (:unread_after_read = 0 and :muted_unread_total = 1 and :muted_notification_count = 0)::integer as mute_valid \gset
\if :mute_valid
\else
  \echo 'Messaging failure: mute did not suppress notifications while retaining unread state.'
  select 1 / 0;
\endif

select public.submit_report('message', :'second_message_id'::uuid, 'harassment', 'Test evidence') as report_id \gset
select count(*)::integer as own_report_count
from public.reports
where id = :'report_id'::uuid and status = 'open' and target_family_id = :'message_family_a'::uuid \gset
\if :own_report_count
\else
  \echo 'Messaging failure: a valid message report was not stored for moderation.'
  select 1 / 0;
\endif

reset role;
insert into public.messages(conversation_id, sender_profile_id, sender_family_id, body)
select :'conversation_id', :'message_profile_a', :'message_family_a', 'Rate fixture ' || value
from generate_series(1, 28) value;
select set_config('request.jwt.claim.sub', :'message_user_a', true);
select set_config('request.jwt.claims', json_build_object('sub', :'message_user_a', 'role', 'authenticated')::text, true);
set local role authenticated;
select pg_temp.message_send_is_denied(:'conversation_id'::uuid)::integer as rate_limited_send_denied \gset
\if :rate_limited_send_denied
\else
  \echo 'Messaging failure: per-minute message rate limit was not enforced.'
  select 1 / 0;
\endif

reset role;
select set_config('request.jwt.claim.sub', :'message_user_b', true);
select set_config('request.jwt.claims', json_build_object('sub', :'message_user_b', 'role', 'authenticated')::text, true);
set local role authenticated;

select public.set_discovery_block(:'message_family_a'::uuid, true);
select public.can_access_family_conversation(:'conversation_id'::uuid)::integer as access_after_block \gset
select count(*)::integer as messages_after_block from public.messages
where conversation_id = :'conversation_id'::uuid \gset
select public.submit_report('family', :'message_family_a'::uuid, 'unsafe_behavior', null);
select public.submit_report('family', :'message_family_a'::uuid, 'spam', null);
select public.submit_report('family', :'message_family_a'::uuid, 'fraud', null);
select public.submit_report('family', :'message_family_a'::uuid, 'impersonation', null);
select pg_temp.report_submit_is_denied(:'message_family_a'::uuid)::integer as rate_limited_report_denied \gset
select (:access_after_block = 0 and :messages_after_block = 0 and :rate_limited_report_denied = 1)::integer as block_valid \gset
\if :block_valid
\else
  \echo 'Messaging failure: blocking did not revoke conversation and message access.'
  select 1 / 0;
\endif

reset role;
select set_config('request.jwt.claim.sub', :'message_user_a', true);
select set_config('request.jwt.claims', json_build_object('sub', :'message_user_a', 'role', 'authenticated')::text, true);
set local role authenticated;
select pg_temp.message_send_is_denied(:'conversation_id'::uuid)::integer as blocked_send_denied \gset
select count(*)::integer as foreign_report_count from public.reports
where id = :'report_id'::uuid \gset
select (:blocked_send_denied = 1 and :foreign_report_count = 0)::integer as post_block_valid \gset
\if :post_block_valid
\else
  \echo 'Messaging failure: blocked sender wrote a message or read another profile report.'
  select 1 / 0;
\endif

reset role;
select set_config('request.jwt.claim.sub', :'message_user_c', true);
select set_config('request.jwt.claims', json_build_object('sub', :'message_user_c', 'role', 'authenticated')::text, true);
set local role authenticated;
select count(*)::integer as unrelated_conversation_count from public.conversations
where id = :'conversation_id'::uuid \gset
select count(*)::integer as unrelated_message_count from public.messages
where conversation_id = :'conversation_id'::uuid \gset
select (:unrelated_conversation_count = 0 and :unrelated_message_count = 0)::integer as unrelated_valid \gset
\if :unrelated_valid
\else
  \echo 'Messaging failure: unrelated family bypassed conversation or message RLS.'
  select 1 / 0;
\endif

reset role;
select count(*)::integer as leaked_audit_content
from public.audit_events
where metadata::text like '%Hello from Family A%'
   or metadata::text like '%Second message%' \gset
\if :leaked_audit_content
  \echo 'Messaging failure: private message content leaked into audit metadata.'
  select 1 / 0;
\endif

rollback;
