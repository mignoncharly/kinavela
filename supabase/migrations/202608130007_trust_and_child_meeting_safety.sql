begin;

create table public.profile_verification_records (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  verification_type text not null check (verification_type in ('email', 'phone', 'community')),
  verification_method text not null check (verification_method in (
    'auth_email_confirmation', 'auth_phone_confirmation',
    'established_village_moderator_endorsement', 'staff_review'
  )),
  verified_by_profile_id uuid references public.profiles(id) on delete set null,
  village_id uuid references public.villages(id) on delete set null,
  statement text not null check (char_length(statement) between 10 and 240),
  verified_at timestamptz not null default now(),
  revoked_at timestamptz,
  revocation_reason text check (
    revocation_reason is null or char_length(revocation_reason) between 2 and 500
  ),
  created_at timestamptz not null default now(),
  check (revoked_at is null or revoked_at >= verified_at)
);

create unique index profile_verification_active_type_idx
  on public.profile_verification_records(profile_id, verification_type)
  where revoked_at is null;
create index profile_verification_profile_time_idx
  on public.profile_verification_records(profile_id, verified_at desc);

create table public.community_verification_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  village_id uuid not null references public.villages(id) on delete cascade,
  status text not null default 'pending' check (
    status in ('pending', 'endorsed', 'approved', 'rejected', 'withdrawn')
  ),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by_profile_id uuid references public.profiles(id) on delete set null,
  review_note text check (review_note is null or char_length(review_note) between 2 and 500),
  updated_at timestamptz not null default now(),
  unique(profile_id, village_id)
);

create index community_verification_queue_idx
  on public.community_verification_requests(status, requested_at);
create index community_verification_village_idx
  on public.community_verification_requests(village_id, status, requested_at);

create table public.meeting_safety_acknowledgements (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  policy_version text not null check (policy_version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  first_context text not null check (
    first_context in ('event_rsvp', 'connection_meeting', 'settings')
  ),
  acknowledged_at timestamptz not null default now(),
  primary key(profile_id, policy_version)
);

alter table public.profile_verification_records enable row level security;
alter table public.profile_verification_records force row level security;
alter table public.community_verification_requests enable row level security;
alter table public.community_verification_requests force row level security;
alter table public.meeting_safety_acknowledgements enable row level security;
alter table public.meeting_safety_acknowledgements force row level security;

revoke all on public.profile_verification_records,
  public.community_verification_requests,
  public.meeting_safety_acknowledgements
  from public, anon, authenticated, service_role;

create trigger community_verification_requests_set_updated_at
  before update on public.community_verification_requests
  for each row execute function public.set_updated_at();

create or replace function kinavela_private.record_auth_verifications(
  p_profile_id uuid,
  p_email_confirmed_at timestamptz,
  p_phone_confirmed_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_email_confirmed_at is not null then
    insert into public.profile_verification_records(
      profile_id, verification_type, verification_method, statement, verified_at
    ) values (
      p_profile_id, 'email', 'auth_email_confirmation',
      'Supabase Auth confirmed control of this profile email address.',
      p_email_confirmed_at
    )
    on conflict (profile_id, verification_type) where revoked_at is null
    do update set verified_at = least(
      public.profile_verification_records.verified_at, excluded.verified_at
    );
  end if;
  if p_phone_confirmed_at is not null then
    insert into public.profile_verification_records(
      profile_id, verification_type, verification_method, statement, verified_at
    ) values (
      p_profile_id, 'phone', 'auth_phone_confirmation',
      'Supabase Auth confirmed control of this profile phone number.',
      p_phone_confirmed_at
    )
    on conflict (profile_id, verification_type) where revoked_at is null
    do update set verified_at = least(
      public.profile_verification_records.verified_at, excluded.verified_at
    );
    update public.profiles
    set verification_level = 'phone_verified', updated_at = now()
    where id = p_profile_id
      and verification_level in ('email_unverified', 'email_verified');
  elsif p_email_confirmed_at is not null then
    update public.profiles
    set verification_level = 'email_verified', updated_at = now()
    where id = p_profile_id and verification_level = 'email_unverified';
  end if;
end;
$$;

insert into public.profile_verification_records(
  profile_id, verification_type, verification_method, statement, verified_at
)
select p.id, 'email', 'auth_email_confirmation',
  'Supabase Auth confirmed control of this profile email address.',
  u.email_confirmed_at
from public.profiles p
join auth.users u on u.id = p.auth_user_id
where u.email_confirmed_at is not null
on conflict (profile_id, verification_type) where revoked_at is null do nothing;

insert into public.profile_verification_records(
  profile_id, verification_type, verification_method, statement, verified_at
)
select p.id, 'phone', 'auth_phone_confirmation',
  'Supabase Auth confirmed control of this profile phone number.',
  u.phone_confirmed_at
from public.profiles p
join auth.users u on u.id = p.auth_user_id
where u.phone_confirmed_at is not null
on conflict (profile_id, verification_type) where revoked_at is null do nothing;

create or replace function kinavela_private.sync_auth_verifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare profile_uuid uuid;
begin
  select id into profile_uuid from public.profiles where auth_user_id = new.id;
  if profile_uuid is not null then
    if new.email_confirmed_at is null then
      update public.profile_verification_records
      set revoked_at = coalesce(revoked_at, now()),
          revocation_reason = coalesce(revocation_reason, 'Auth email confirmation is no longer active.')
      where profile_id = profile_uuid and verification_type = 'email' and revoked_at is null;
    end if;
    if new.phone_confirmed_at is null then
      update public.profile_verification_records
      set revoked_at = coalesce(revoked_at, now()),
          revocation_reason = coalesce(revocation_reason, 'Auth phone confirmation is no longer active.')
      where profile_id = profile_uuid and verification_type = 'phone' and revoked_at is null;
      update public.profiles
      set verification_level = case
          when new.email_confirmed_at is null then 'email_unverified'
          else 'email_verified'
        end,
        updated_at = now()
      where id = profile_uuid and verification_level = 'phone_verified';
    end if;
    perform kinavela_private.record_auth_verifications(
      profile_uuid, new.email_confirmed_at, new.phone_confirmed_at
    );
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_confirmed on auth.users;
drop trigger if exists on_auth_user_verifications_changed on auth.users;
create trigger on_auth_user_verifications_changed
  after update of email_confirmed_at, phone_confirmed_at on auth.users
  for each row execute function kinavela_private.sync_auth_verifications();
drop trigger if exists on_auth_user_verifications_created on auth.users;
create trigger on_auth_user_verifications_created
  after insert on auth.users
  for each row execute function kinavela_private.sync_auth_verifications();

create or replace function kinavela_private.has_meeting_safety_acknowledgement(
  p_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.meeting_safety_acknowledgements
    where profile_id = p_profile_id and policy_version = '2026-08-13'
  )
$$;

create or replace function public.get_my_trust_status()
returns table (
  email_verified boolean,
  phone_verified boolean,
  community_verified boolean,
  community_method text,
  community_statement text,
  community_request_status text,
  meeting_safety_acknowledged boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with current_profile as (
    select p.id, p.auth_user_id
    from public.profiles p
    where p.id = public.current_profile_id()
  )
  select
    u.email_confirmed_at is not null,
    u.phone_confirmed_at is not null,
    community.id is not null,
    community.verification_method,
    community.statement,
    request.status,
    kinavela_private.has_meeting_safety_acknowledgement(profile.id)
  from current_profile profile
  join auth.users u on u.id = profile.auth_user_id
  left join lateral (
    select record.id, record.verification_method, record.statement
    from public.profile_verification_records record
    where record.profile_id = profile.id
      and record.verification_type = 'community'
      and record.revoked_at is null
    order by record.verified_at desc
    limit 1
  ) community on true
  left join lateral (
    select verification_request.status
    from public.community_verification_requests verification_request
    where verification_request.profile_id = profile.id
    order by verification_request.updated_at desc
    limit 1
  ) request on true
$$;

create or replace function public.sync_my_auth_verifications()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_uuid uuid := public.current_profile_id();
  auth_row record;
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  select email_confirmed_at, phone_confirmed_at into auth_row
  from auth.users where id = auth.uid();
  if not found then raise exception 'auth_user_not_found'; end if;
  perform kinavela_private.record_auth_verifications(
    profile_uuid, auth_row.email_confirmed_at, auth_row.phone_confirmed_at
  );
  return true;
end;
$$;

create or replace function public.acknowledge_meeting_safety(p_context text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare profile_uuid uuid := public.current_profile_id();
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  if p_context not in ('event_rsvp', 'connection_meeting', 'settings') then
    raise exception 'invalid_safety_context';
  end if;
  insert into public.meeting_safety_acknowledgements(
    profile_id, policy_version, first_context
  ) values (profile_uuid, '2026-08-13', p_context)
  on conflict(profile_id, policy_version) do nothing;
  if found then
    insert into public.audit_events(actor_profile_id, event_type, entity_type, entity_id)
    values (profile_uuid, 'meeting_safety_acknowledged', 'profile', profile_uuid);
  end if;
  return true;
end;
$$;

create or replace function public.request_community_verification(p_village_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_uuid uuid := public.current_profile_id();
  family_uuid uuid := kinavela_private.current_family_id(false);
  request_uuid uuid;
begin
  if profile_uuid is null or family_uuid is null then raise exception 'not_authenticated'; end if;
  if not kinavela_private.is_village_family_member(p_village_id, family_uuid, false) then
    raise exception 'village_membership_required';
  end if;
  if exists (
    select 1 from public.profile_verification_records
    where profile_id = profile_uuid and verification_type = 'community' and revoked_at is null
  ) then raise exception 'already_community_verified'; end if;
  insert into public.community_verification_requests(profile_id, family_id, village_id)
  values (profile_uuid, family_uuid, p_village_id)
  on conflict(profile_id, village_id) do update
  set status = 'pending', requested_at = now(), reviewed_at = null,
      reviewed_by_profile_id = null, review_note = null, updated_at = now()
  where public.community_verification_requests.status in ('rejected', 'withdrawn')
  returning id into request_uuid;
  if request_uuid is null then raise exception 'verification_request_exists'; end if;
  insert into public.audit_events(actor_profile_id, event_type, entity_type, entity_id)
  values (profile_uuid, 'community_verification_requested', 'verification_request', request_uuid);
  return request_uuid;
end;
$$;

create or replace function public.list_village_verification_requests(p_village_id uuid)
returns table (
  request_id uuid,
  profile_display_name text,
  family_name text,
  requested_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not kinavela_private.can_access_village(p_village_id, true) then
    raise exception 'not_authorized';
  end if;
  return query
  select request.id, profile.display_name, family.name, request.requested_at
  from public.community_verification_requests request
  join public.profiles profile on profile.id = request.profile_id
  join public.families family on family.id = request.family_id
  where request.village_id = p_village_id and request.status = 'pending'
    and request.family_id <> kinavela_private.current_family_id(false)
  order by request.requested_at;
end;
$$;

create or replace function public.endorse_community_verification(p_request_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_uuid uuid := public.current_profile_id();
  actor_family_uuid uuid := kinavela_private.current_family_id(false);
  request_row public.community_verification_requests%rowtype;
begin
  if actor_uuid is null or actor_family_uuid is null then raise exception 'not_authenticated'; end if;
  select * into request_row from public.community_verification_requests
  where id = p_request_id and status = 'pending' for update;
  if request_row.id is null
    or request_row.family_id = actor_family_uuid
    or not kinavela_private.can_access_village(request_row.village_id, true) then
    raise exception 'verification_request_not_available';
  end if;
  if not exists (
    select 1 from public.profile_verification_records
    where profile_id = actor_uuid and verification_type = 'community' and revoked_at is null
  ) then raise exception 'established_verifier_required'; end if;
  insert into public.profile_verification_records(
    profile_id, verification_type, verification_method, verified_by_profile_id,
    village_id, statement
  ) values (
    request_row.profile_id, 'community',
    'established_village_moderator_endorsement', actor_uuid,
    request_row.village_id,
    'An established community-verified Village moderator endorsed this adult profile.'
  )
  on conflict (profile_id, verification_type) where revoked_at is null do nothing;
  update public.community_verification_requests
  set status = 'endorsed', reviewed_at = now(), reviewed_by_profile_id = actor_uuid
  where id = request_row.id;
  update public.profiles set verification_level = 'community_verified', updated_at = now()
  where id = request_row.profile_id and verification_level <> 'identity_verified';
  insert into public.audit_events(actor_profile_id, event_type, entity_type, entity_id,
    metadata)
  values (actor_uuid, 'community_verification_endorsed', 'verification_request',
    request_row.id, jsonb_build_object('village_id', request_row.village_id));
  return true;
end;
$$;

alter table public.events
  add column moderation_status text not null default 'clear'
    check (moderation_status in ('clear', 'restricted')),
  add column restricted_at timestamptz,
  add column restricted_by_profile_id uuid references public.profiles(id) on delete set null;

alter table public.reports
  add column target_event_id uuid references public.events(id) on delete set null,
  add column severity text not null default 'medium'
    check (severity in ('low', 'medium', 'high', 'critical')),
  add column urgent_child_safety boolean not null default false,
  add column assigned_to_profile_id uuid references public.profiles(id) on delete set null,
  add column assigned_at timestamptz,
  add column response_due_at timestamptz,
  add column resolution_notes text check (
    resolution_notes is null or char_length(resolution_notes) between 2 and 1000
  );

alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports drop constraint if exists reports_target_shape_check;
alter table public.reports drop constraint if exists reports_reason_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('family', 'message', 'village', 'event'));
alter table public.reports add constraint reports_target_shape_check check (
  (target_type = 'family' and target_family_id is not null and target_message_id is null
    and conversation_id is null and target_village_id is null and target_event_id is null)
  or (target_type = 'message' and target_family_id is not null and target_message_id is not null
    and conversation_id is not null and target_event_id is null)
  or (target_type = 'village' and target_village_id is not null and target_family_id is null
    and target_message_id is null and conversation_id is null and target_event_id is null)
  or (target_type = 'event' and target_event_id is not null and target_village_id is not null
    and target_family_id is null and target_message_id is null and conversation_id is null)
);
alter table public.reports add constraint reports_reason_check check (reason in (
  'harassment', 'spam', 'fraud', 'unsafe_behavior', 'inappropriate_child_content',
  'discrimination', 'impersonation', 'unsafe_location', 'inappropriate_conduct',
  'misleading_event', 'child_safety_concern', 'other'
));

create index reports_target_event_idx
  on public.reports(target_event_id, status, created_at desc);
create index reports_response_queue_idx
  on public.reports(status, urgent_child_safety desc, response_due_at, created_at);

create table public.report_action_history (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  action_type text not null check (action_type in (
    'submitted', 'assigned', 'note_added', 'severity_changed', 'escalated',
    'event_cancelled', 'event_restricted', 'resolved', 'dismissed'
  )),
  previous_status text,
  new_status text,
  severity text check (severity is null or severity in ('low', 'medium', 'high', 'critical')),
  note text check (note is null or char_length(note) between 2 and 1000),
  created_at timestamptz not null default now()
);

create index report_action_history_report_time_idx
  on public.report_action_history(report_id, created_at);
alter table public.report_action_history enable row level security;
alter table public.report_action_history force row level security;
revoke all on public.report_action_history from public, anon, authenticated, service_role;

create or replace function kinavela_private.prepare_report_triage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.reason in ('child_safety_concern', 'inappropriate_child_content') then
    new.severity := 'critical';
    new.urgent_child_safety := true;
  elsif new.reason in ('unsafe_location', 'unsafe_behavior', 'inappropriate_conduct') then
    new.severity := 'high';
  elsif new.reason in ('fraud', 'discrimination', 'harassment', 'misleading_event') then
    new.severity := 'medium';
  else
    new.severity := 'low';
  end if;
  new.response_due_at := new.created_at + case new.severity
    when 'critical' then interval '1 hour'
    when 'high' then interval '24 hours'
    when 'medium' then interval '72 hours'
    else interval '7 days'
  end;
  return new;
end;
$$;

create trigger reports_prepare_triage
  before insert on public.reports
  for each row execute function kinavela_private.prepare_report_triage();

update public.reports set
  severity = case
    when reason in ('inappropriate_child_content') then 'critical'
    when reason in ('unsafe_behavior') then 'high'
    when reason in ('fraud', 'discrimination', 'harassment') then 'medium'
    else 'low'
  end,
  urgent_child_safety = reason = 'inappropriate_child_content',
  response_due_at = created_at + case
    when reason in ('inappropriate_child_content') then interval '1 hour'
    when reason in ('unsafe_behavior') then interval '24 hours'
    when reason in ('fraud', 'discrimination', 'harassment') then interval '72 hours'
    else interval '7 days'
  end
where response_due_at is null;

insert into public.report_action_history(
  report_id, actor_profile_id, action_type, new_status, severity, created_at
)
select id, reporter_profile_id, 'submitted', status, severity, created_at
from public.reports;

create or replace function kinavela_private.log_report_submission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.report_action_history(
    report_id, actor_profile_id, action_type, new_status, severity, created_at
  ) values (
    new.id, new.reporter_profile_id, 'submitted', new.status, new.severity, new.created_at
  );
  return new;
end;
$$;

create trigger reports_log_submission
  after insert on public.reports
  for each row execute function kinavela_private.log_report_submission();

create or replace function kinavela_private.moderate_report_event(
  p_event_id uuid,
  p_actor_profile_id uuid,
  p_action text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare event_row public.events%rowtype; attendee record;
begin
  if p_action not in ('cancel_event', 'restrict_event') then
    raise exception 'invalid_event_moderation_action';
  end if;
  select * into event_row from public.events where id = p_event_id for update;
  if event_row.id is null then raise exception 'event_not_available'; end if;
  update public.events set
    status = case when status = 'scheduled' then 'cancelled' else status end,
    cancelled_at = case when status = 'scheduled' then now() else cancelled_at end,
    moderation_status = case when p_action = 'restrict_event' then 'restricted' else moderation_status end,
    restricted_at = case when p_action = 'restrict_event' then now() else restricted_at end,
    restricted_by_profile_id = case
      when p_action = 'restrict_event' then p_actor_profile_id
      else restricted_by_profile_id
    end
  where id = p_event_id;
  delete from public.event_reminder_deliveries
  where event_id = p_event_id and reminder_kind = 'scheduled_24h';
  if event_row.status = 'scheduled' then
    for attendee in
      select family_id from public.event_attendees
      where event_id = p_event_id and status in ('going', 'maybe', 'waitlisted')
    loop
      perform kinavela_private.queue_event_delivery(
        p_event_id, attendee.family_id, 'event_cancelled', now()
      );
    end loop;
  end if;
  insert into public.audit_events(actor_profile_id, event_type, entity_type, entity_id,
    metadata)
  values (
    p_actor_profile_id,
    case when p_action = 'restrict_event' then 'event_restricted' else 'event_cancelled_by_moderation' end,
    'event', p_event_id, '{}'::jsonb
  );
end;
$$;

create or replace function public.submit_report(
  p_target_type text,
  p_target_id uuid,
  p_reason text,
  p_details text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_uuid uuid := public.current_profile_id();
  family_uuid uuid := kinavela_private.current_family_id(false);
  target_family_uuid uuid;
  target_message_uuid uuid;
  target_village_uuid uuid;
  target_event_uuid uuid;
  conversation_uuid uuid;
  report_uuid uuid;
  clean_details text := nullif(btrim(coalesce(p_details, '')), '');
  recent_reports integer;
begin
  if profile_uuid is null or family_uuid is null then raise exception 'not_authenticated'; end if;
  if p_target_type not in ('family', 'message', 'event') then raise exception 'invalid_report_target'; end if;
  if p_reason not in (
    'harassment', 'spam', 'fraud', 'unsafe_behavior', 'inappropriate_child_content',
    'discrimination', 'impersonation', 'unsafe_location', 'inappropriate_conduct',
    'misleading_event', 'child_safety_concern', 'other'
  ) then raise exception 'invalid_report_reason'; end if;
  if p_target_type = 'event' and p_reason not in (
    'unsafe_location', 'inappropriate_conduct', 'misleading_event',
    'child_safety_concern', 'discrimination', 'fraud', 'other'
  ) then raise exception 'invalid_report_reason'; end if;
  if clean_details is not null and char_length(clean_details) > 1000 then
    raise exception 'invalid_report_details';
  end if;
  select count(*) into recent_reports from public.reports
  where reporter_profile_id = profile_uuid and created_at >= now() - interval '24 hours';
  if recent_reports >= 5 then raise exception 'report_rate_limited'; end if;

  if p_target_type = 'family' then
    target_family_uuid := p_target_id;
    if target_family_uuid = family_uuid or not exists (
      select 1 from public.family_connections connection
      where family_uuid in (connection.requester_family_id, connection.recipient_family_id)
        and target_family_uuid in (connection.requester_family_id, connection.recipient_family_id)
    ) then raise exception 'report_target_not_available'; end if;
  elsif p_target_type = 'message' then
    select message.id, message.sender_family_id, message.conversation_id
    into target_message_uuid, target_family_uuid, conversation_uuid
    from public.messages message
    join public.conversations conversation on conversation.id = message.conversation_id
    where message.id = p_target_id
      and message.deleted_at is null
      and (
        (conversation.conversation_type = 'family' and exists (
          select 1 from public.family_connections connection
          where connection.id = conversation.family_connection_id
            and family_uuid in (connection.requester_family_id, connection.recipient_family_id)
        ))
        or (conversation.conversation_type = 'village'
          and kinavela_private.is_village_family_member(conversation.village_id, family_uuid, false))
      );
    if target_message_uuid is null or target_family_uuid = family_uuid then
      raise exception 'report_target_not_available';
    end if;
  else
    select event.id, event.village_id
    into target_event_uuid, target_village_uuid
    from public.events event
    where event.id = p_target_id
      and event.creator_family_id <> family_uuid
      and kinavela_private.is_village_family_member(event.village_id, family_uuid, false);
    if target_event_uuid is null then raise exception 'report_target_not_available'; end if;
  end if;

  insert into public.reports(
    reporter_profile_id, reporter_family_id, target_type, target_family_id,
    target_message_id, conversation_id, target_village_id, target_event_id,
    reason, details
  ) values (
    profile_uuid, family_uuid, p_target_type, target_family_uuid,
    target_message_uuid, conversation_uuid, target_village_uuid, target_event_uuid,
    p_reason, clean_details
  ) returning id into report_uuid;
  insert into public.audit_events(actor_profile_id, event_type, entity_type, entity_id)
  values (profile_uuid, 'report_submitted', 'report', report_uuid);
  return report_uuid;
end;
$$;

drop function if exists public.list_village_reports(uuid);
create function public.list_village_reports(p_village_id uuid)
returns table (
  report_id uuid,
  target_type text,
  target_family_id uuid,
  target_family_name text,
  target_message_id uuid,
  target_event_id uuid,
  target_event_title text,
  reason text,
  details text,
  status text,
  severity text,
  urgent_child_safety boolean,
  response_due_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not kinavela_private.can_access_village(p_village_id, true) then
    raise exception 'not_authorized';
  end if;
  return query
  select report.id, report.target_type, report.target_family_id, family.name,
    report.target_message_id, report.target_event_id, event.title,
    report.reason, report.details, report.status, report.severity,
    report.urgent_child_safety, report.response_due_at, report.created_at
  from public.reports report
  left join public.families family on family.id = report.target_family_id
  left join public.events event on event.id = report.target_event_id
  where report.target_village_id = p_village_id
    and report.status in ('open', 'reviewing')
  order by report.urgent_child_safety desc, report.response_due_at, report.created_at;
end;
$$;

create or replace function public.resolve_village_report(
  p_report_id uuid,
  p_resolution text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_uuid uuid := public.current_profile_id();
  family_uuid uuid := kinavela_private.current_family_id(false);
  report_row public.reports%rowtype;
  target_role text;
  previous_status text;
begin
  if p_resolution not in (
    'dismiss', 'delete_message', 'remove_member', 'escalate',
    'cancel_event', 'restrict_event'
  ) then raise exception 'invalid_resolution'; end if;
  select * into report_row from public.reports
  where id = p_report_id and status in ('open', 'reviewing') for update;
  if report_row.id is null or report_row.target_village_id is null
    or not kinavela_private.can_access_village(report_row.target_village_id, true) then
    raise exception 'report_not_available';
  end if;
  if report_row.urgent_child_safety and p_resolution = 'dismiss' then
    raise exception 'urgent_report_requires_staff_review';
  end if;
  previous_status := report_row.status;
  if p_resolution = 'delete_message' then
    if report_row.target_message_id is null then raise exception 'invalid_resolution'; end if;
    update public.messages set deleted_at = now()
    where id = report_row.target_message_id
      and conversation_id = report_row.conversation_id and deleted_at is null;
    if not found then raise exception 'message_not_available'; end if;
    insert into public.village_moderation_actions(
      village_id, actor_profile_id, actor_family_id, action_type,
      target_family_id, target_message_id, report_id
    ) values (
      report_row.target_village_id, profile_uuid, family_uuid, 'message_removed',
      report_row.target_family_id, report_row.target_message_id, report_row.id
    );
    update public.reports set status = 'reviewing' where id = report_row.id;
  elsif p_resolution = 'remove_member' then
    if report_row.target_family_id is null then raise exception 'invalid_resolution'; end if;
    select role into target_role from public.village_members
    where village_id = report_row.target_village_id
      and family_id = report_row.target_family_id and status = 'active';
    if target_role is null or target_role = 'owner' then raise exception 'not_authorized'; end if;
    perform public.remove_village_member(
      report_row.target_village_id, report_row.target_family_id
    );
    update public.reports set status = 'reviewing' where id = report_row.id;
  elsif p_resolution in ('cancel_event', 'restrict_event') then
    if report_row.target_event_id is null then raise exception 'invalid_resolution'; end if;
    perform kinavela_private.moderate_report_event(
      report_row.target_event_id, profile_uuid, p_resolution
    );
    update public.reports set status = 'reviewing' where id = report_row.id;
  elsif p_resolution = 'escalate' then
    update public.reports set
      status = 'reviewing',
      severity = case when severity in ('low', 'medium') then 'high' else severity end,
      response_due_at = least(response_due_at, now() + interval '24 hours')
    where id = report_row.id;
  else
    insert into public.village_moderation_actions(
      village_id, actor_profile_id, actor_family_id, action_type,
      target_family_id, target_message_id, report_id
    ) values (
      report_row.target_village_id, profile_uuid, family_uuid, 'report_dismissed',
      report_row.target_family_id, report_row.target_message_id, report_row.id
    );
    update public.reports set status = 'dismissed' where id = report_row.id;
  end if;
  insert into public.report_action_history(
    report_id, actor_profile_id, action_type, previous_status, new_status, severity
  )
  select report_row.id, profile_uuid,
    case p_resolution
      when 'cancel_event' then 'event_cancelled'
      when 'restrict_event' then 'event_restricted'
      when 'escalate' then 'escalated'
      when 'dismiss' then 'dismissed'
      else 'escalated'
    end,
    previous_status, status, severity
  from public.reports where id = report_row.id;
  return true;
end;
$$;

drop function if exists public.admin_list_reports(text, integer);
create function public.admin_list_reports(p_status text default null, p_limit integer default 100)
returns table (
  report_id uuid,
  target_type text,
  target_family_id uuid,
  target_message_id uuid,
  target_village_id uuid,
  target_event_id uuid,
  target_event_title text,
  reason text,
  details text,
  status text,
  severity text,
  urgent_child_safety boolean,
  assigned_to_profile_id uuid,
  response_due_at timestamptz,
  resolution_notes text,
  reporter_profile_id uuid,
  action_count bigint,
  created_at timestamptz,
  updated_at timestamptz
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
  if p_status is not null and p_status not in ('open', 'reviewing', 'resolved', 'dismissed') then
    raise exception 'invalid_report_status';
  end if;
  return query
  select report.id, report.target_type, report.target_family_id,
    report.target_message_id, report.target_village_id, report.target_event_id,
    event.title, report.reason, report.details, report.status, report.severity,
    report.urgent_child_safety, report.assigned_to_profile_id,
    report.response_due_at, report.resolution_notes, report.reporter_profile_id,
    (select count(*) from public.report_action_history history where history.report_id = report.id),
    report.created_at, report.updated_at
  from public.reports report
  left join public.events event on event.id = report.target_event_id
  where p_status is null or report.status = p_status
  order by report.urgent_child_safety desc, report.response_due_at, report.created_at
  limit least(greatest(coalesce(p_limit, 100), 1), 200);
end;
$$;

create or replace function public.admin_manage_report(
  p_report_id uuid,
  p_action text,
  p_severity text default null,
  p_note text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_uuid uuid := public.current_profile_id();
  report_row public.reports%rowtype;
  clean_note text := nullif(btrim(coalesce(p_note, '')), '');
  new_status text;
begin
  if not kinavela_private.is_admin(actor_uuid) then raise exception 'admin_required'; end if;
  if p_action not in (
    'assign_to_me', 'add_note', 'set_severity', 'resolve', 'dismiss',
    'cancel_event', 'restrict_event'
  ) then raise exception 'invalid_report_action'; end if;
  if p_severity is not null and p_severity not in ('low', 'medium', 'high', 'critical') then
    raise exception 'invalid_report_severity';
  end if;
  if clean_note is not null and char_length(clean_note) > 1000 then
    raise exception 'invalid_report_note';
  end if;
  if p_action in ('add_note', 'resolve', 'dismiss', 'cancel_event', 'restrict_event')
    and clean_note is null then raise exception 'report_note_required';
  end if;
  select * into report_row from public.reports where id = p_report_id for update;
  if report_row.id is null then raise exception 'report_not_found'; end if;
  if p_action = 'assign_to_me' then
    update public.reports set assigned_to_profile_id = actor_uuid,
      assigned_at = now(), status = 'reviewing'
    where id = p_report_id;
  elsif p_action = 'set_severity' then
    if p_severity is null then raise exception 'invalid_report_severity'; end if;
    update public.reports set severity = p_severity,
      urgent_child_safety = urgent_child_safety or p_severity = 'critical',
      response_due_at = least(
        coalesce(response_due_at, 'infinity'::timestamptz),
        now() + case p_severity
          when 'critical' then interval '1 hour'
          when 'high' then interval '24 hours'
          when 'medium' then interval '72 hours'
          else interval '7 days'
        end
      )
    where id = p_report_id;
  elsif p_action = 'add_note' then
    update public.reports set status = 'reviewing' where id = p_report_id;
  elsif p_action in ('cancel_event', 'restrict_event') then
    if report_row.target_event_id is null then raise exception 'invalid_report_action'; end if;
    perform kinavela_private.moderate_report_event(
      report_row.target_event_id, actor_uuid, p_action
    );
    update public.reports set status = 'reviewing' where id = p_report_id;
  else
    update public.reports set
      status = case when p_action = 'resolve' then 'resolved' else 'dismissed' end,
      resolution_notes = clean_note
    where id = p_report_id;
  end if;
  select status into new_status from public.reports where id = p_report_id;
  insert into public.report_action_history(
    report_id, actor_profile_id, action_type, previous_status, new_status,
    severity, note
  ) values (
    p_report_id, actor_uuid,
    case p_action
      when 'assign_to_me' then 'assigned'
      when 'add_note' then 'note_added'
      when 'set_severity' then 'severity_changed'
      when 'cancel_event' then 'event_cancelled'
      when 'restrict_event' then 'event_restricted'
      when 'resolve' then 'resolved'
      else 'dismissed'
    end,
    report_row.status, new_status, coalesce(p_severity, report_row.severity), clean_note
  );
  insert into public.audit_events(actor_profile_id, event_type, entity_type, entity_id,
    metadata)
  values (
    actor_uuid, 'report_moderation_action', 'report', p_report_id,
    jsonb_build_object('action', p_action, 'severity', coalesce(p_severity, report_row.severity))
  );
  return true;
end;
$$;

create or replace function public.admin_list_verification_requests(p_limit integer default 100)
returns table (
  request_id uuid,
  profile_id uuid,
  profile_display_name text,
  family_name text,
  village_name text,
  status text,
  requested_at timestamptz
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
  select request.id, request.profile_id, profile.display_name, family.name,
    village.name, request.status, request.requested_at
  from public.community_verification_requests request
  join public.profiles profile on profile.id = request.profile_id
  join public.families family on family.id = request.family_id
  join public.villages village on village.id = request.village_id
  where request.status = 'pending'
  order by request.requested_at
  limit least(greatest(coalesce(p_limit, 100), 1), 200);
end;
$$;

create or replace function public.admin_review_verification_request(
  p_request_id uuid,
  p_approve boolean,
  p_note text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_uuid uuid := public.current_profile_id();
  request_row public.community_verification_requests%rowtype;
  clean_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not kinavela_private.is_admin(actor_uuid) then raise exception 'admin_required'; end if;
  if clean_note is null or char_length(clean_note) > 500 then
    raise exception 'verification_review_note_required';
  end if;
  select * into request_row from public.community_verification_requests
  where id = p_request_id and status = 'pending' for update;
  if request_row.id is null then raise exception 'verification_request_not_available'; end if;
  if p_approve then
    insert into public.profile_verification_records(
      profile_id, verification_type, verification_method, verified_by_profile_id,
      village_id, statement
    ) values (
      request_row.profile_id, 'community', 'staff_review', actor_uuid,
      request_row.village_id,
      'Kinavela staff reviewed and approved this adult profile community-verification request.'
    )
    on conflict (profile_id, verification_type) where revoked_at is null do nothing;
    update public.profiles set verification_level = 'community_verified', updated_at = now()
    where id = request_row.profile_id and verification_level <> 'identity_verified';
  end if;
  update public.community_verification_requests set
    status = case when p_approve then 'approved' else 'rejected' end,
    reviewed_at = now(), reviewed_by_profile_id = actor_uuid, review_note = clean_note
  where id = request_row.id;
  insert into public.audit_events(actor_profile_id, event_type, entity_type, entity_id,
    metadata)
  values (
    actor_uuid, 'community_verification_reviewed', 'verification_request',
    request_row.id, jsonb_build_object('approved', p_approve)
  );
  return true;
end;
$$;

create or replace function public.rsvp_village_event(
  p_event_id uuid,
  p_status text,
  p_number_of_adults integer default 1,
  p_number_of_children integer default 0
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_uuid uuid := public.current_profile_id();
  family_uuid uuid := kinavela_private.current_family_id(true);
  event_row public.events%rowtype;
  previous_status text;
  effective_status text := p_status;
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  if family_uuid is null then raise exception 'not_authorized'; end if;
  if p_status in ('going', 'maybe')
    and not kinavela_private.has_meeting_safety_acknowledgement(profile_uuid) then
    raise exception 'meeting_safety_acknowledgement_required';
  end if;
  select * into event_row from public.events where id = p_event_id for update;
  if event_row.id is null or event_row.status <> 'scheduled'
    or event_row.moderation_status = 'restricted'
    or not kinavela_private.is_village_family_member(event_row.village_id, family_uuid, false) then
    raise exception 'event_not_available';
  end if;
  if now() > event_row.registration_deadline then raise exception 'registration_closed'; end if;
  if p_status not in ('going', 'maybe', 'declined')
    or p_number_of_adults not between 0 and 10
    or p_number_of_children not between 0 and 20
    or p_number_of_adults + p_number_of_children not between 1 and 30 then
    raise exception 'invalid_rsvp';
  end if;
  select status into previous_status from public.event_attendees
  where event_id = p_event_id and family_id = family_uuid for update;
  if p_status = 'going' and event_row.max_families is not null
    and coalesce(previous_status, '') <> 'going'
    and (select count(*) from public.event_attendees
      where event_id = p_event_id and status = 'going') >= event_row.max_families then
    effective_status := 'waitlisted';
  end if;
  insert into public.event_attendees(
    event_id, family_id, status, number_of_adults, number_of_children
  ) values (
    p_event_id, family_uuid, effective_status, p_number_of_adults, p_number_of_children
  ) on conflict(event_id, family_id) do update set
    status = excluded.status,
    number_of_adults = excluded.number_of_adults,
    number_of_children = excluded.number_of_children,
    attendance_confirmed_at = null,
    attendance_confirmed_by_profile_id = null,
    updated_at = now();
  if effective_status = 'going' then
    perform kinavela_private.queue_event_delivery(
      p_event_id, family_uuid, 'scheduled_24h',
      greatest(now(), event_row.starts_at - interval '24 hours')
    );
  else
    delete from public.event_reminder_deliveries
    where event_id = p_event_id and recipient_profile_id in (
      select profile_id from public.family_members where family_id = family_uuid
    ) and reminder_kind = 'scheduled_24h';
  end if;
  if previous_status = 'going' and effective_status <> 'going' then
    perform kinavela_private.promote_event_waitlist(p_event_id);
  end if;
  insert into public.audit_events(actor_profile_id, event_type, entity_type, entity_id,
    metadata)
  values (
    profile_uuid, 'event_rsvp', 'event', p_event_id,
    jsonb_build_object('status', effective_status)
  );
  return effective_status;
end;
$$;

create or replace function public.record_real_life_meeting(p_connection_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_uuid uuid := public.current_profile_id();
  family_uuid uuid;
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  if not kinavela_private.has_meeting_safety_acknowledgement(profile_uuid) then
    raise exception 'meeting_safety_acknowledgement_required';
  end if;
  family_uuid := kinavela_private.current_family_id(true);
  if family_uuid is null or not exists (
    select 1 from public.family_connections connection
    where connection.id = p_connection_id and connection.status = 'accepted'
      and family_uuid in (connection.requester_family_id, connection.recipient_family_id)
  ) then raise exception 'connection_not_accepted'; end if;
  insert into public.audit_events(actor_profile_id, event_type, entity_type, entity_id,
    metadata)
  values (
    profile_uuid, 'real_life_meeting_confirmed', 'family_connection',
    p_connection_id, jsonb_build_object('family_id', family_uuid)
  );
  return true;
end;
$$;

revoke all on function kinavela_private.record_auth_verifications(uuid,timestamptz,timestamptz),
  kinavela_private.sync_auth_verifications(),
  kinavela_private.has_meeting_safety_acknowledgement(uuid),
  kinavela_private.prepare_report_triage(),
  kinavela_private.log_report_submission(),
  kinavela_private.moderate_report_event(uuid,uuid,text)
  from public, anon, authenticated, service_role;

revoke all on function public.get_my_trust_status(),
  public.sync_my_auth_verifications(),
  public.acknowledge_meeting_safety(text),
  public.request_community_verification(uuid),
  public.list_village_verification_requests(uuid),
  public.endorse_community_verification(uuid),
  public.submit_report(text,uuid,text,text),
  public.list_village_reports(uuid),
  public.resolve_village_report(uuid,text),
  public.admin_list_reports(text,integer),
  public.admin_manage_report(uuid,text,text,text),
  public.admin_list_verification_requests(integer),
  public.admin_review_verification_request(uuid,boolean,text),
  public.rsvp_village_event(uuid,text,integer,integer),
  public.record_real_life_meeting(uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.get_my_trust_status(),
  public.sync_my_auth_verifications(),
  public.acknowledge_meeting_safety(text),
  public.request_community_verification(uuid),
  public.list_village_verification_requests(uuid),
  public.endorse_community_verification(uuid),
  public.submit_report(text,uuid,text,text),
  public.list_village_reports(uuid),
  public.resolve_village_report(uuid,text),
  public.rsvp_village_event(uuid,text,integer,integer),
  public.record_real_life_meeting(uuid)
  to authenticated;

grant execute on function public.admin_list_reports(text,integer),
  public.admin_manage_report(uuid,text,text,text),
  public.admin_list_verification_requests(integer),
  public.admin_review_verification_request(uuid,boolean,text)
  to authenticated;

revoke execute on function public.admin_set_report_status(uuid,text) from authenticated;

comment on table public.profile_verification_records is
  'Exact verification facts; no record is a statement that a person is safe.';
comment on table public.meeting_safety_acknowledgements is
  'Adult acknowledgement of concise offline-meeting guidance; not a safety guarantee.';

insert into kinavela_private.schema_migrations(version)
values ('202608130007_trust_and_child_meeting_safety');

notify pgrst, 'reload schema';
commit;
