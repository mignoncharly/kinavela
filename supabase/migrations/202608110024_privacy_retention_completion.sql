begin;

insert into kinavela_private.retention_policies(policy_key, resource, retention_days, action, notes)
values
  ('story_requests_expired', 'story_requests and story media after expiry/revocation', 30, 'delete', 'Remove private story audio and rows after the 30-day grace window.'),
  ('notification_outbox', 'notification_outbox.created_at', 30, 'delete', 'Remove delivery payloads after the operational delivery window.'),
  ('event_reminder_deliveries', 'event_reminder_deliveries.created_at', 90, 'delete', 'Remove event reminder recipient payloads after 90 days.'),
  ('notification_events', 'notification_events.created_at and notifications.created_at', 365, 'delete', 'Remove in-app notification payloads after one year.'),
  ('product_events', 'product_events.occurred_at', 180, 'delete', 'First-party pilot metrics only; no advertising profile.'),
  ('security_audit_events', 'audit_events and resolved moderation records', 730, 'review', 'Retain longer only for safety, legal or incident hold.'),
  ('geocoding_cache', 'geocoding_cache.expires_at', 1, 'delete', 'Delete expired city-search cache rows; the expiry timestamp is the effective control.'),
  ('rate_limit_hashes', 'rate-limit window timestamps', 1, 'delete', 'Delete hashed identifiers after the abuse-prevention window.'),
  ('ai_job_data', 'ai_jobs and ai_usage.created_at', 90, 'delete', 'Applies only if AI is enabled; provider is disabled in current production.'),
  ('account_deletion_requests_completed', 'account_deletion_requests.completed_at', 90, 'delete', 'Keep minimum deletion audit evidence for 90 days.')
on conflict (policy_key) do update set
  resource = excluded.resource,
  retention_days = excluded.retention_days,
  action = excluded.action,
  notes = excluded.notes,
  updated_at = now();

create or replace function public.claim_expired_story_media()
returns table(bucket text, path text)
language sql
security definer
set search_path = ''
as $$
  select 'story-audio'::text, story.original_audio_path
  from public.family_stories story
  join public.story_requests request on request.id = story.story_request_id
  where (request.status in ('expired', 'revoked') or request.expires_at < now())
    and request.created_at < now() - interval '30 days'
    and story.original_audio_path is not null
$$;

create or replace function public.claim_expired_privacy_export_paths()
returns table(path text)
language sql
security definer
set search_path = ''
as $$
  select file_path
  from public.personal_data_exports
  where status = 'ready'
    and expires_at is not null
    and expires_at < now()
    and file_path is not null
$$;

create or replace function public.purge_expired_story_data()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare removed integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role_required';
  end if;
  delete from public.family_stories story
  using public.story_requests request
  where request.id = story.story_request_id
    and (request.status in ('expired', 'revoked') or request.expires_at < now())
    and request.created_at < now() - interval '30 days';
  get diagnostics removed = row_count;
  delete from public.story_requests request
  where (request.status in ('expired', 'revoked') or request.expires_at < now())
    and request.created_at < now() - interval '30 days';
  return removed;
end;
$$;

create or replace function public.anonymize_account_deletion(p_request_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.account_deletion_requests%rowtype;
  profile_uuid uuid;
  family_uuid uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  select * into request_row
  from public.account_deletion_requests
  where id = p_request_id
  for update;

  if request_row.id is null or request_row.status <> 'processing' then
    raise exception 'deletion_not_processing';
  end if;

  profile_uuid := request_row.profile_id;
  select member.family_id into family_uuid
  from public.family_members member
  where member.profile_id = profile_uuid
  order by member.created_at
  limit 1;

  if family_uuid is not null then
    delete from public.ai_usage where profile_id = profile_uuid or family_id = family_uuid;
    delete from public.ai_jobs where created_by_profile_id = profile_uuid or family_id = family_uuid;
    delete from public.village_cluster_responses
      where responded_by_profile_id = profile_uuid or family_id = family_uuid;
    delete from public.family_mission_progress
      where started_by_profile_id = profile_uuid
         or completed_by_profile_id = profile_uuid
         or family_id = family_uuid;
    delete from public.event_attendees where family_id = family_uuid;
    delete from public.discovery_blocks
      where blocker_family_id = family_uuid or blocked_family_id = family_uuid;
    delete from public.connection_request_attempts where family_id = family_uuid;
    delete from public.roots_passport_entries
      where created_by_profile_id = profile_uuid
         or passport_id in (
           select passport.id
           from public.roots_passports passport
           join public.children child on child.id = passport.child_id
           where child.family_id = family_uuid
         );
    delete from public.family_stories where family_id = family_uuid;
    delete from public.story_requests where family_id = family_uuid;
    delete from public.children where family_id = family_uuid;

    delete from kinavela_private.event_locations location
    where location.event_id in (
      select event.id from public.events event
      where event.creator_family_id = family_uuid
    );
    update public.events
    set title = 'Removed event',
        description = 'This event was removed after account deletion.',
        location_name = 'Removed',
        location_city = 'Removed',
        public_location_description = 'Location removed.',
        status = 'cancelled',
        cancelled_at = coalesce(cancelled_at, now()),
        updated_at = now()
    where creator_family_id = family_uuid or creator_profile_id = profile_uuid;

    update public.villages
    set name = 'Removed village',
        slug = 'deleted-' || id::text,
        description = 'This village was archived after account deletion.',
        city = 'Removed',
        center_location = extensions.st_geogfromtext('SRID=4326;POINT(0 0)'),
        visibility = 'private',
        status = 'archived',
        updated_at = now()
    where created_by_family_id = family_uuid or created_by_profile_id = profile_uuid;

    update public.village_members
    set status = 'removed', role = 'member', responded_at = coalesce(responded_at, now()), updated_at = now()
    where family_id = family_uuid;

    update public.families
    set name = 'Deleted family',
        slug = 'deleted-' || id::text,
        city = 'Removed',
        bio = null,
        location = null,
        preservation_goals = '{}',
        visibility = 'private',
        updated_at = now()
    where id = family_uuid;

    update public.family_members
    set status = 'removed', role = 'member'
    where profile_id = profile_uuid;
  end if;

  update public.messages
  set body = '[deleted message]',
      deleted_at = coalesce(deleted_at, now()),
      edited_at = now()
  where sender_profile_id = profile_uuid;

  update public.reports
  set details = null, updated_at = now()
  where reporter_profile_id = profile_uuid;

  delete from public.consents where profile_id = profile_uuid;
  delete from public.notification_push_subscriptions where profile_id = profile_uuid;
  delete from public.notification_preferences where profile_id = profile_uuid;
  delete from public.notification_outbox where recipient_profile_id = profile_uuid;
  delete from public.notification_events where recipient_profile_id = profile_uuid;
  delete from public.notifications where recipient_profile_id = profile_uuid;
  delete from public.event_reminder_deliveries where recipient_profile_id = profile_uuid;
  delete from public.personal_data_exports where profile_id = profile_uuid;
  delete from public.pilot_waitlist where profile_id = profile_uuid;
  delete from public.product_events where profile_id = profile_uuid;

  update public.profiles
  set display_name = 'Deleted account',
      avatar_path = null,
      country_of_residence = null,
      city = null,
      onboarding_completed = false,
      verification_level = 'email_unverified',
      status = 'deleted',
      updated_at = now()
  where id = profile_uuid;

  update public.account_deletion_requests
  set status = 'completed', completed_at = now(), updated_at = now()
  where id = p_request_id;

  insert into public.audit_events(event_type, entity_type, entity_id, metadata)
  values (
    'account_deletion_completed',
    'account_deletion_request',
    p_request_id,
    jsonb_build_object('mode', 'logical_erasure')
  );
  return true;
end;
$$;

create or replace function public.run_gdpr_retention()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  outbox_deleted bigint;
  reminder_deleted bigint;
  events_deleted bigint;
  connection_notifications_deleted bigint;
  product_events_deleted bigint;
  audit_deleted bigint;
  moderation_deleted bigint;
  geocoding_deleted bigint;
  rate_limit_deleted bigint;
  ai_usage_deleted bigint;
  ai_jobs_deleted bigint;
  deletion_requests_deleted bigint;
  exports_expired bigint;
  stories_deleted integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  delete from public.notification_outbox
  where created_at < now() - interval '30 days';
  get diagnostics outbox_deleted = row_count;

  delete from public.event_reminder_deliveries
  where created_at < now() - interval '90 days';
  get diagnostics reminder_deleted = row_count;

  delete from public.notification_events
  where created_at < now() - interval '365 days';
  get diagnostics events_deleted = row_count;

  delete from public.notifications
  where created_at < now() - interval '365 days';
  get diagnostics connection_notifications_deleted = row_count;

  delete from public.product_events
  where occurred_at < now() - interval '180 days';
  get diagnostics product_events_deleted = row_count;

  delete from public.village_moderation_actions
  where created_at < now() - interval '730 days';
  get diagnostics moderation_deleted = row_count;

  delete from public.audit_events
  where created_at < now() - interval '730 days'
    and event_type not in (
      'report_submitted',
      'account_deletion_requested',
      'account_deletion_completed'
    );
  get diagnostics audit_deleted = row_count;

  delete from public.geocoding_cache where expires_at < now();
  get diagnostics geocoding_deleted = row_count;

  delete from public.geocoding_rate_limits
  where window_started_at < now() - interval '1 day';
  get diagnostics rate_limit_deleted = row_count;

  delete from kinavela_private.auth_rate_limits
  where window_started_at < now() - interval '1 day';

  delete from public.connection_request_attempts
  where attempted_at < now() - interval '30 days';

  delete from public.ai_usage
  where created_at < now() - interval '90 days';
  get diagnostics ai_usage_deleted = row_count;

  delete from public.ai_jobs
  where created_at < now() - interval '90 days';
  get diagnostics ai_jobs_deleted = row_count;

  delete from kinavela_private.ai_quota_state
  where period_start < current_date -  interval '18 months';

  delete from public.account_deletion_requests
  where status = 'completed'
    and completed_at < now() - interval '90 days';
  get diagnostics deletion_requests_deleted = row_count;

  update public.personal_data_exports
  set status = 'expired', file_path = null, updated_at = now()
  where status = 'ready'
    and expires_at < now();
  get diagnostics exports_expired = row_count;

  delete from public.personal_data_exports
  where status in ('expired', 'failed')
    and updated_at < now() - interval '7 days';

  delete from public.roots_passport_exports
  where status in ('expired', 'failed')
    and coalesce(expires_at, requested_at) < now() - interval '30 days';

  stories_deleted := public.purge_expired_story_data();

  return jsonb_build_object(
    'notification_outbox_deleted', outbox_deleted,
    'event_reminders_deleted', reminder_deleted,
    'notification_events_deleted', events_deleted,
    'connection_notifications_deleted', connection_notifications_deleted,
    'product_events_deleted', product_events_deleted,
    'audit_events_deleted', audit_deleted,
    'moderation_events_deleted', moderation_deleted,
    'geocoding_rows_deleted', geocoding_deleted,
    'rate_limit_rows_deleted', rate_limit_deleted,
    'ai_usage_deleted', ai_usage_deleted,
    'ai_jobs_deleted', ai_jobs_deleted,
    'deletion_requests_deleted', deletion_requests_deleted,
    'exports_expired', exports_expired,
    'stories_deleted', stories_deleted,
    'completed_at', now()
  );
end;
$$;

revoke all on function public.claim_expired_story_media(), public.claim_expired_privacy_export_paths(), public.purge_expired_story_data(), public.run_gdpr_retention() from public, anon, authenticated;
grant execute on function public.claim_expired_story_media(), public.claim_expired_privacy_export_paths(), public.purge_expired_story_data(), public.run_gdpr_retention() to service_role;

insert into kinavela_private.schema_migrations(version)
values ('202608110024_privacy_retention_completion')
on conflict (version) do nothing;

notify pgrst, 'reload schema';
commit;
