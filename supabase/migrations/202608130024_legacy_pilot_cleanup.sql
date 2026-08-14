begin;

-- Admission remains Germany-wide regardless of any retained legacy state.
drop trigger if exists families_enforce_pilot_limit on public.families;
drop function if exists kinavela_private.enforce_pilot_family_limit();
drop function if exists kinavela_private.enforce_pilot_location(text, text);
drop function if exists public.admin_set_pilot_region_status(text, text, text);

update kinavela_private.pilot_settings
set enabled = false, updated_at = now()
where id = true;

alter function kinavela_private.pilot_city_key(text)
rename to regional_city_key;
alter function kinavela_private.capture_pilot_audit_event()
rename to capture_product_event;
alter trigger audit_events_capture_pilot_metrics on public.audit_events
rename to audit_events_capture_product_metrics;

create table kinavela_private.legacy_waitlist_archive (
  waitlist_id uuid primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  country_code text not null,
  city text not null,
  culture_focus text not null,
  original_status text not null,
  joined_at timestamptz not null,
  archived_at timestamptz not null default now(),
  retained_until timestamptz not null default now() + interval '180 days',
  migration_outcome text not null check (
    migration_outcome in ('active_family', 'onboarding_invited', 'inactive_account')
  )
);

create index legacy_waitlist_archive_retention_idx
on kinavela_private.legacy_waitlist_archive(retained_until);
revoke all on kinavela_private.legacy_waitlist_archive
from public, anon, authenticated;

create table kinavela_private.regional_interest_history (
  country_code text not null,
  city_key text not null,
  display_city text not null,
  historical_interest_count bigint not null check (historical_interest_count >= 0),
  first_joined_at timestamptz,
  last_joined_at timestamptz,
  snapshot_at timestamptz not null default now(),
  primary key(country_code, city_key)
);
revoke all on kinavela_private.regional_interest_history
from public, anon, authenticated;

insert into kinavela_private.legacy_waitlist_archive(
  waitlist_id, profile_id, country_code, city, culture_focus,
  original_status, joined_at, migration_outcome
)
select waitlist.id, waitlist.profile_id, waitlist.country_code,
  waitlist.city, waitlist.culture_focus, waitlist.status, waitlist.joined_at,
  case
    when profile.status <> 'active' then 'inactive_account'
    when profile.onboarding_completed then 'active_family'
    else 'onboarding_invited'
  end
from public.pilot_waitlist waitlist
join public.profiles profile on profile.id = waitlist.profile_id
on conflict(waitlist_id) do nothing;

insert into kinavela_private.regional_interest_history(
  country_code, city_key, display_city, historical_interest_count,
  first_joined_at, last_joined_at, snapshot_at
)
select waitlist.country_code,
  kinavela_private.regional_city_key(waitlist.city),
  min(waitlist.city), count(*), min(waitlist.joined_at),
  max(waitlist.joined_at), now()
from public.pilot_waitlist waitlist
group by waitlist.country_code,
  kinavela_private.regional_city_key(waitlist.city)
on conflict(country_code, city_key) do update set
  display_city = excluded.display_city,
  historical_interest_count = excluded.historical_interest_count,
  first_joined_at = excluded.first_joined_at,
  last_joined_at = excluded.last_joined_at,
  snapshot_at = excluded.snapshot_at;

alter table public.notification_events
  drop constraint if exists notification_events_notification_kind_check;
alter table public.notification_events
  add constraint notification_events_notification_kind_check check (
    notification_kind in (
      'connection_request','connection_accepted','message_received',
      'event_reminder','village_activity','story_ready',
      'compatible_family_available','passport_export_ready',
      'referral_accepted','village_invitation','village_join_request',
      'village_join_decision','event_invitation','event_changed',
      'event_rsvp_update','playdate_proposal','support_response',
      'report_resolved','story_failed','germany_access_opened'
    )
  );

alter table public.notification_outbox
  drop constraint if exists notification_outbox_notification_kind_check;
alter table public.notification_outbox
  add constraint notification_outbox_notification_kind_check check (
    notification_kind in (
      'connection_request','connection_accepted','message_received',
      'event_reminder','village_activity','story_ready',
      'compatible_family_available','passport_export_ready',
      'referral_accepted','village_invitation','village_join_request',
      'village_join_decision','event_invitation','event_changed',
      'event_rsvp_update','playdate_proposal','support_response',
      'report_resolved','story_failed','germany_access_opened'
    )
  );

-- Every active legacy profile receives an in-app service notice. Optional
-- email and push rows are created only when the existing consent and device
-- preferences allow those channels.
insert into public.notification_outbox(
  recipient_profile_id, channel, notification_kind, entity_type,
  entity_id, payload, scheduled_at
)
select archive.profile_id, 'in_app', 'germany_access_opened',
  'legacy_waitlist', archive.waitlist_id,
  jsonb_build_object('country_code', 'DE', 'access', 'available'), now()
from kinavela_private.legacy_waitlist_archive archive
join public.profiles profile on profile.id = archive.profile_id
where profile.status = 'active'
on conflict do nothing;

insert into public.notification_outbox(
  recipient_profile_id, channel, notification_kind, entity_type,
  entity_id, payload, scheduled_at
)
select archive.profile_id, 'email', 'germany_access_opened',
  'legacy_waitlist', archive.waitlist_id,
  jsonb_build_object('country_code', 'DE', 'access', 'available'), now()
from kinavela_private.legacy_waitlist_archive archive
join public.profiles profile on profile.id = archive.profile_id
join public.notification_preferences preferences
  on preferences.profile_id = archive.profile_id
where profile.status = 'active' and preferences.email_enabled
  and exists (
    select 1 from public.consents consent
    where consent.profile_id = archive.profile_id
      and consent.consent_type = 'product_email'
      and consent.revoked_at is null
  )
on conflict do nothing;

insert into public.notification_outbox(
  recipient_profile_id, channel, notification_kind, entity_type,
  entity_id, payload, scheduled_at
)
select archive.profile_id, 'push', 'germany_access_opened',
  'legacy_waitlist', archive.waitlist_id,
  jsonb_build_object('country_code', 'DE', 'access', 'available'), now()
from kinavela_private.legacy_waitlist_archive archive
join public.profiles profile on profile.id = archive.profile_id
join public.notification_preferences preferences
  on preferences.profile_id = archive.profile_id
where profile.status = 'active' and preferences.push_enabled
  and exists (
    select 1 from public.notification_push_subscriptions subscription
    where subscription.profile_id = archive.profile_id
  )
on conflict do nothing;

update public.pilot_waitlist waitlist
set status = case
    when profile.status <> 'active' then 'withdrawn'
    when profile.onboarding_completed then 'activated'
    else 'invited'
  end,
  updated_at = now()
from public.profiles profile
where profile.id = waitlist.profile_id
  and waitlist.status in ('waiting', 'invited');


alter function public.get_personal_data_export_payload(uuid)
rename to get_personal_data_export_payload_phase13;

create function public.get_personal_data_export_payload(p_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare payload jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role_required';
  end if;
  payload := public.get_personal_data_export_payload_phase13(p_profile_id);
  return payload || jsonb_build_object(
    'legacy_access_migration', coalesce((
      select jsonb_agg(
        to_jsonb(archive) - 'profile_id' order by archive.archived_at
      )
      from kinavela_private.legacy_waitlist_archive archive
      where archive.profile_id = p_profile_id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function
  public.get_personal_data_export_payload_phase13(uuid),
  public.get_personal_data_export_payload(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.get_personal_data_export_payload(uuid)
to service_role;

alter function public.admin_list_pilot_metrics(timestamptz)
rename to admin_list_product_metrics;
revoke all on function public.admin_list_product_metrics(timestamptz)
from public, anon, authenticated, service_role;
grant execute on function public.admin_list_product_metrics(timestamptz)
to authenticated;

drop function if exists public.admin_list_regional_density();
create function public.admin_list_regional_outreach()
returns table(
  country_code text,
  city text,
  historical_interest_count bigint,
  family_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not kinavela_private.is_admin(public.current_profile_id()) then
    raise exception 'admin_required';
  end if;
  return query
  with locations as (
    select history.country_code, history.city_key,
      history.display_city as city,
      history.historical_interest_count
    from kinavela_private.regional_interest_history history
    union
    select 'DE'::text, kinavela_private.regional_city_key(family.city),
      family.city, 0::bigint
    from public.families family
    where family.country_of_residence = 'DE'
  ), regions as (
    select location.country_code, location.city_key,
      min(location.city) as city,
      max(location.historical_interest_count) as historical_interest_count
    from locations location
    group by location.country_code, location.city_key
  )
  select region.country_code, region.city,
    region.historical_interest_count,
    (
      select count(*)
      from public.families family
      join public.profiles profile on profile.id = family.created_by
      where family.country_of_residence = region.country_code
        and kinavela_private.regional_city_key(family.city) = region.city_key
        and family.visibility = 'discoverable'
        and profile.status = 'active'
    )
  from regions region
  order by region.city;
end;
$$;
revoke all on function public.admin_list_regional_outreach()
from public, anon, authenticated, service_role;
grant execute on function public.admin_list_regional_outreach()
to authenticated;

create function public.purge_legacy_pilot_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare waitlist_deleted bigint; archive_deleted bigint;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role_required';
  end if;
  delete from public.pilot_waitlist waitlist
  using kinavela_private.legacy_waitlist_archive archive
  where archive.waitlist_id = waitlist.id
    and archive.retained_until < now();
  get diagnostics waitlist_deleted = row_count;
  delete from kinavela_private.legacy_waitlist_archive
  where retained_until < now();
  get diagnostics archive_deleted = row_count;
  return jsonb_build_object(
    'waitlist_rows_deleted', waitlist_deleted,
    'archive_rows_deleted', archive_deleted,
    'completed_at', now()
  );
end;
$$;

create function kinavela_private.erase_legacy_waitlist_on_profile_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'deleted' and old.status is distinct from new.status then
    delete from public.pilot_waitlist where profile_id = new.id;
    delete from kinavela_private.legacy_waitlist_archive
    where profile_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_erase_legacy_waitlist on public.profiles;
create trigger profiles_erase_legacy_waitlist
after update of status on public.profiles
for each row execute function
kinavela_private.erase_legacy_waitlist_on_profile_deletion();

revoke all on function public.purge_legacy_pilot_data()
from public, anon, authenticated;
grant execute on function public.purge_legacy_pilot_data()
to service_role;
revoke all on function
kinavela_private.erase_legacy_waitlist_on_profile_deletion()
from public, anon, authenticated, service_role;

insert into kinavela_private.processing_activities(
  activity_key, purpose, data_categories, data_subjects, recipients,
  legal_basis, retention_rule, international_transfer, safeguards
)
values (
  'legacy_access_migration',
  'Retire historical admission waitlists and inform affected account holders',
  array['profile reference','city','historical waitlist state'],
  array['former pilot waitlist account holders'],
  array['Supabase Database','Zoho SMTP only with existing product-email consent'],
  'contract for in-app service notice; consent for optional email and push',
  'identifiable rollback archive deleted after 180 days; city totals retained only as reviewed aggregates',
  'Zoho transfer safeguards apply only to already-consented email delivery',
  'private schema, no browser grants, bounded retention, identity-free notification payload'
)
on conflict(activity_key) do update set
  purpose = excluded.purpose,
  data_categories = excluded.data_categories,
  data_subjects = excluded.data_subjects,
  recipients = excluded.recipients,
  legal_basis = excluded.legal_basis,
  retention_rule = excluded.retention_rule,
  international_transfer = excluded.international_transfer,
  safeguards = excluded.safeguards,
  updated_at = now();

update kinavela_private.retention_policies
set notes = 'First-party product health metrics only; no advertising profile.',
    updated_at = now()
where policy_key = 'product_events';

insert into kinavela_private.retention_policies(
  policy_key, resource, retention_days, action, notes
)
values
  ('legacy_waitlist_archive',
   'legacy_waitlist_archive and migrated pilot_waitlist rows', 180, 'delete',
   'Bounded rollback and audit window after Germany-wide access migration.'),
  ('regional_interest_history',
   'de-identified city-level historical interest totals', 730, 'review',
   'Aggregate outreach planning only; contains no profile or family identity.')
on conflict(policy_key) do update set
  resource = excluded.resource,
  retention_days = excluded.retention_days,
  action = excluded.action,
  notes = excluded.notes,
  updated_at = now();

comment on table public.pilot_waitlist is
  'Retired admission-era records retained for a bounded rollback window; never an access control.';
comment on table kinavela_private.pilot_regions is
  'Read-only legacy regional configuration retained for rollback review; never an access control.';
comment on table kinavela_private.pilot_settings is
  'Disabled legacy admission settings retained for rollback review; never read by onboarding.';

insert into kinavela_private.schema_migrations(version)
values ('202608130024_legacy_pilot_cleanup')
on conflict(version) do nothing;

notify pgrst, 'reload schema';
commit;
