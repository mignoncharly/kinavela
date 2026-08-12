begin;

create table if not exists kinavela_private.processing_activities (
  activity_key text primary key check (activity_key ~ '^[a-z][a-z0-9_]{2,80}$'),
  purpose text not null,
  data_categories text[] not null default '{}',
  data_subjects text[] not null default '{}',
  recipients text[] not null default '{}',
  legal_basis text not null,
  retention_rule text not null,
  international_transfer text not null,
  safeguards text not null,
  owner text not null default 'Kinavela',
  updated_at timestamptz not null default now()
);

create table if not exists kinavela_private.retention_policies (
  policy_key text primary key check (policy_key ~ '^[a-z][a-z0-9_]{2,80}$'),
  resource text not null,
  retention_days integer not null check (retention_days > 0),
  action text not null check (action in ('delete', 'review')),
  enabled boolean not null default true,
  notes text not null,
  updated_at timestamptz not null default now()
);

alter table kinavela_private.processing_activities enable row level security;
alter table kinavela_private.processing_activities force row level security;
alter table kinavela_private.retention_policies enable row level security;
alter table kinavela_private.retention_policies force row level security;
revoke all on kinavela_private.processing_activities, kinavela_private.retention_policies from public, anon, authenticated;

insert into kinavela_private.processing_activities(activity_key, purpose, data_categories, data_subjects, recipients, legal_basis, retention_rule, international_transfer, safeguards)
values
  ('account_auth', 'Create and secure accounts', array['email','auth identifier','profile preferences'], array['adult account holders'], array['Supabase Auth','Supabase Database'], 'contract and security interests', 'account lifetime plus deletion workflow', 'EU hosting where configured; review any support access', 'least privilege, RLS, audit events, encrypted transport'),
  ('family_children', 'Preserve family heritage and enable family features', array['family profile','child nickname and year','culture and language links'], array['families','children'], array['Supabase Database','Supabase Storage'], 'contract and guardian action; child data requires special care', 'account lifetime plus deletion workflow', 'EU hosting where configured', 'guardian-only access, private storage, minimal child fields'),
  ('communications_safety', 'Provide messaging, reporting and moderation', array['messages','reports','moderation metadata'], array['community members'], array['Supabase Database'], 'contract and legitimate interests in safety', 'operational need and safety review; then deletion or minimisation', 'EU hosting where configured', 'restricted moderation access, audit trail, abuse controls'),
  ('stories_media', 'Store family stories, transcripts and passport media', array['voice recordings','transcripts','cultural memories','media metadata'], array['families and invited storytellers'], array['Supabase Storage','configured AI provider only when enabled'], 'explicit family action/consent and contract', 'account lifetime plus deletion workflow; exports expire after 7 days', 'AI transfer is disabled until provider and DPA are approved', 'private buckets, signed URLs, no public media policy'),
  ('billing', 'Manage subscriptions and legal accounting', array['Stripe customer and subscription identifiers','billing events'], array['purchasing family owners'], array['Stripe','Supabase Database'], 'contract and legal obligations', 'controller-approved finance retention; automated deletion disabled', 'Stripe transfer safeguards and DPA review', 'webhook verification, restricted service role access'),
  ('notifications', 'Deliver opted-in email, push and in-app notifications', array['email preference','push endpoint keys','notification payload'], array['account holders'], array['Zoho SMTP','Supabase Database'], 'consent for product email; contract for essential service notices', 'preferences until withdrawal; delivery records per retention policy', 'Zoho DPA and transfer safeguards must be reviewed', 'explicit opt-in, revocation path, no marketing by default'),
  ('operations_security', 'Operate, secure and improve the service', array['audit events','security metadata','error diagnostics'], array['users and visitors'], array['Supabase','Sentry only when configured','hosting provider'], 'legitimate interests and legal obligations', 'shortest operational period compatible with safety and law', 'processor and transfer review required per provider', 'access controls, minimisation, retention review')
on conflict (activity_key) do update set purpose = excluded.purpose, data_categories = excluded.data_categories, data_subjects = excluded.data_subjects, recipients = excluded.recipients, legal_basis = excluded.legal_basis, retention_rule = excluded.retention_rule, international_transfer = excluded.international_transfer, safeguards = excluded.safeguards, updated_at = now();

insert into kinavela_private.retention_policies(policy_key, resource, retention_days, action, notes)
values
  ('personal_data_exports', 'personal_data_exports.ready', 7, 'delete', 'Product default; remove private export object and row after expiry.'),
  ('story_requests_expired', 'story_requests.revoked_or_expired', 30, 'delete', 'Delete expired request and associated story/audio after media cleanup.'),
  ('notification_outbox', 'notification_outbox.created_at', 30, 'delete', 'Remove delivery payloads after operational delivery window.'),
  ('notification_events', 'notification_events.created_at', 365, 'delete', 'Remove in-app notification payloads after one year.'),
  ('account_deletion_requests_completed', 'account_deletion_requests.completed_at', 90, 'delete', 'Keep only the minimum deletion audit evidence needed after completion.'),
  ('subscription_events', 'subscription_events.created_at', 2555, 'review', 'Review with finance/controller before enabling deletion.'),
  ('audit_events', 'audit_events.created_at', 2555, 'review', 'Review with safety/legal owners; not an automatic deletion claim.')
on conflict (policy_key) do update set resource = excluded.resource, retention_days = excluded.retention_days, action = excluded.action, notes = excluded.notes, updated_at = now();

create table public.personal_data_exports (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued','processing','ready','failed','expired')),
  file_path text check (file_path is null or char_length(file_path) between 10 and 500),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  expires_at timestamptz,
  error_code text check (error_code is null or error_code ~ '^[a-z0-9_]{2,80}$'),
  updated_at timestamptz not null default now(),
  check ((status = 'ready' and file_path is not null and completed_at is not null and expires_at is not null) or status <> 'ready')
);

create unique index personal_data_exports_active_unique on public.personal_data_exports(profile_id) where status in ('queued','processing');
create index personal_data_exports_expiry_idx on public.personal_data_exports(status, expires_at);
alter table public.personal_data_exports enable row level security;
alter table public.personal_data_exports force row level security;
revoke all on public.personal_data_exports from public, anon, authenticated;
grant all on public.personal_data_exports to service_role;
create trigger personal_data_exports_set_updated_at before update on public.personal_data_exports for each row execute function public.set_updated_at();

create or replace function public.request_personal_data_export()
returns uuid language plpgsql security definer set search_path = '' as $$
declare profile_uuid uuid := public.current_profile_id(); export_uuid uuid;
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.profiles where id = profile_uuid and status = 'active') then raise exception 'account_not_active'; end if;
  insert into public.personal_data_exports(profile_id) values (profile_uuid)
    on conflict (profile_id) where status in ('queued','processing') do update set requested_at = now(), updated_at = now()
    returning id into export_uuid;
  insert into public.audit_events(actor_profile_id, event_type, entity_type, entity_id) values (profile_uuid, 'personal_data_export_requested', 'personal_data_export', export_uuid);
  return export_uuid;
end;
$$;

create or replace function public.list_my_personal_data_exports()
returns table(export_id uuid, status text, requested_at timestamptz, completed_at timestamptz, expires_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select id, status, requested_at, completed_at, expires_at from public.personal_data_exports where profile_id = public.current_profile_id() order by requested_at desc limit 10;
$$;

create or replace function public.claim_personal_data_export()
returns table(export_id uuid, profile_id uuid)
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'service_role_required'; end if;
  return query with picked as (select export.id from public.personal_data_exports export where export.status = 'queued' order by export.requested_at for update skip locked limit 1), claimed as (update public.personal_data_exports export set status = 'processing', updated_at = now() where export.id in (select id from picked) returning export.id, export.profile_id) select claimed.id, claimed.profile_id from claimed;
end;
$$;

create or replace function public.get_personal_data_export_payload(p_profile_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare payload jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'service_role_required'; end if;
  select jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(profile) - 'auth_user_id' - 'avatar_path' from public.profiles profile where profile.id = p_profile_id),
    'families', coalesce((select jsonb_agg(to_jsonb(family) - 'location' order by family.created_at) from public.families family join public.family_members member on member.family_id = family.id where member.profile_id = p_profile_id), '[]'::jsonb),
    'children', coalesce((select jsonb_agg(to_jsonb(child) - 'avatar_path' order by child.created_at) from public.children child join public.family_members member on member.family_id = child.family_id where member.profile_id = p_profile_id and member.status = 'active'), '[]'::jsonb),
    'consents', coalesce((select jsonb_agg(to_jsonb(consent) order by consent.created_at) from public.consents consent where consent.profile_id = p_profile_id), '[]'::jsonb),
    'notifications', coalesce((select to_jsonb(preferences) - 'profile_id' from public.notification_preferences preferences where preferences.profile_id = p_profile_id), '{}'::jsonb),
    'stories', coalesce((select jsonb_agg(to_jsonb(story) - 'original_audio_path' order by story.created_at) from public.family_stories story join public.family_members member on member.family_id = story.family_id where member.profile_id = p_profile_id and member.status = 'active'), '[]'::jsonb),
    'passport_entries', coalesce((select jsonb_agg(to_jsonb(entry) - 'media_path' order by entry.created_at) from public.roots_passport_entries entry join public.roots_passports passport on passport.id = entry.passport_id join public.children child on child.id = passport.child_id join public.family_members member on member.family_id = child.family_id where member.profile_id = p_profile_id and member.status = 'active'), '[]'::jsonb),
    'messages', coalesce((select jsonb_agg(to_jsonb(message) order by message.created_at) from public.messages message where message.sender_profile_id = p_profile_id), '[]'::jsonb),
    'reports', coalesce((select jsonb_agg(to_jsonb(report) order by report.created_at) from public.reports report where report.reporter_profile_id = p_profile_id), '[]'::jsonb)
  ) into payload;
  return payload;
end;
$$;

create or replace function public.complete_personal_data_export(p_export_id uuid, p_file_path text, p_expires_at timestamptz default now() + interval '7 days')
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'service_role_required'; end if;
  if p_file_path is null or p_file_path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\\.json$' then raise exception 'invalid_export_path'; end if;
  update public.personal_data_exports set status = 'ready', file_path = p_file_path, completed_at = now(), expires_at = p_expires_at, error_code = null, updated_at = now() where id = p_export_id and status = 'processing';
  if not found then raise exception 'export_not_processing'; end if;
  insert into public.audit_events(event_type, entity_type, entity_id) values ('personal_data_export_ready', 'personal_data_export', p_export_id);
  return true;
end;
$$;

create or replace function public.fail_personal_data_export(p_export_id uuid, p_error_code text default 'export_failed')
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'service_role_required'; end if;
  update public.personal_data_exports set status = 'failed', error_code = left(coalesce(p_error_code, 'export_failed'), 80), updated_at = now() where id = p_export_id and status = 'processing';
  return found;
end;
$$;

create or replace function public.get_my_personal_data_export_path(p_export_id uuid)
returns table(file_path text, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  if public.current_profile_id() is null then raise exception 'not_authenticated'; end if;
  return query select export.file_path, export.expires_at from public.personal_data_exports export where export.id = p_export_id and export.profile_id = public.current_profile_id() and export.status = 'ready' and export.expires_at > now();
end;
$$;

create or replace function public.get_my_consents()
returns table(consent_type text, policy_version text, granted_at timestamptz, revoked_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select consent_type, policy_version, granted_at, revoked_at from public.consents where profile_id = public.current_profile_id() order by created_at desc;
$$;

create or replace function public.set_product_email_consent(p_enabled boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare profile_uuid uuid := public.current_profile_id();
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  if p_enabled then
    insert into public.consents(profile_id, consent_type, policy_version) values (profile_uuid, 'product_email', 'notifications-v1') on conflict (profile_id, consent_type) where revoked_at is null do nothing;
  else
    update public.consents set revoked_at = coalesce(revoked_at, now()) where profile_id = profile_uuid and consent_type = 'product_email' and revoked_at is null;
  end if;
  insert into public.audit_events(actor_profile_id, event_type, entity_type, metadata) values (profile_uuid, case when p_enabled then 'product_email_consent_granted' else 'product_email_consent_revoked' end, 'consent', jsonb_build_object('consent_type','product_email','policy_version','notifications-v1'));
  return true;
end;
$$;

create or replace function public.claim_account_deletion()
returns table(request_id uuid, profile_id uuid, auth_user_id uuid, media_paths jsonb)
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'service_role_required'; end if;
  return query with picked as (select request.id from public.account_deletion_requests request where request.status = 'pending' order by request.requested_at for update skip locked limit 1), claimed as (update public.account_deletion_requests request set status = 'processing', updated_at = now() where request.id in (select id from picked) returning request.id, request.profile_id), paths as (
    select claimed.id, claimed.profile_id, profile.auth_user_id, coalesce((select jsonb_agg(jsonb_build_object('bucket','roots-media','path',entry.media_path)) from public.roots_passport_entries entry join public.roots_passports passport on passport.id = entry.passport_id join public.children child on child.id = passport.child_id join public.family_members member on member.family_id = child.family_id where member.profile_id = claimed.profile_id and entry.media_path is not null), '[]'::jsonb) || coalesce((select jsonb_agg(jsonb_build_object('bucket','story-audio','path',story.original_audio_path)) from public.family_stories story join public.family_members member on member.family_id = story.family_id where member.profile_id = claimed.profile_id and story.original_audio_path is not null), '[]'::jsonb) || coalesce((select jsonb_agg(jsonb_build_object('bucket','privacy-exports','path',export.file_path)) from public.personal_data_exports export where export.profile_id = claimed.profile_id and export.file_path is not null), '[]'::jsonb) as media_paths from claimed join public.profiles profile on profile.id = claimed.profile_id)
  select paths.id, paths.profile_id, paths.auth_user_id, paths.media_paths from paths;
end;
$$;

create or replace function public.anonymize_account_deletion(p_request_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare request_row public.account_deletion_requests%rowtype; profile_uuid uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'service_role_required'; end if;
  select * into request_row from public.account_deletion_requests where id = p_request_id for update;
  if request_row.id is null or request_row.status <> 'processing' then raise exception 'deletion_not_processing'; end if;
  profile_uuid := request_row.profile_id;
  update public.messages set body = '[deleted message]', deleted_at = coalesce(deleted_at, now()), edited_at = now() where sender_profile_id = profile_uuid;
  update public.families set name = 'Deleted family', slug = 'deleted-' || id::text, city = 'Deleted', bio = null, location = null, preservation_goals = '{}', visibility = 'private', updated_at = now() where created_by = profile_uuid;
  delete from public.consents where profile_id = profile_uuid;
  delete from public.notification_push_subscriptions where profile_id = profile_uuid;
  delete from public.notification_preferences where profile_id = profile_uuid;
  delete from public.personal_data_exports where profile_id = profile_uuid;
  update public.family_members set status = 'removed', role = 'member' where profile_id = profile_uuid;
  update public.profiles set display_name = 'Deleted account', avatar_path = null, country_of_residence = null, city = null, onboarding_completed = false, verification_level = 'email_unverified', status = 'deleted', updated_at = now() where id = profile_uuid;
  update public.account_deletion_requests set status = 'completed', completed_at = now(), updated_at = now() where id = p_request_id;
  insert into public.audit_events(event_type, entity_type, entity_id, metadata) values ('account_deletion_completed', 'account_deletion_request', p_request_id, jsonb_build_object('profile_id', profile_uuid, 'mode', 'logical_erasure')); 
  return true;
end;
$$;

create or replace function public.run_gdpr_retention()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'service_role_required'; end if;
  delete from public.notification_outbox where created_at < now() - interval '30 days';
  delete from public.notification_events where created_at < now() - interval '365 days';
  delete from public.account_deletion_requests where status = 'completed' and completed_at < now() - interval '90 days';
  update public.personal_data_exports set status = 'expired', file_path = null, updated_at = now() where status = 'ready' and expires_at < now();
  select jsonb_build_object('notification_outbox_deleted', (select count(*) from public.notification_outbox where false), 'completed_at', now()) into result;
  return result;
end;
$$;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('privacy-exports', 'privacy-exports', false, 5000000, array['application/json'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

revoke all on function public.request_personal_data_export(), public.list_my_personal_data_exports(), public.get_my_personal_data_export_path(uuid), public.get_my_consents(), public.set_product_email_consent(boolean) from public, anon;
grant execute on function public.request_personal_data_export(), public.list_my_personal_data_exports(), public.get_my_personal_data_export_path(uuid), public.get_my_consents(), public.set_product_email_consent(boolean) to authenticated;
revoke all on function public.claim_personal_data_export(), public.get_personal_data_export_payload(uuid), public.complete_personal_data_export(uuid,text,timestamptz), public.fail_personal_data_export(uuid,text), public.claim_account_deletion(), public.anonymize_account_deletion(uuid), public.run_gdpr_retention() from public, anon, authenticated;
grant execute on function public.claim_personal_data_export(), public.get_personal_data_export_payload(uuid), public.complete_personal_data_export(uuid,text,timestamptz), public.fail_personal_data_export(uuid,text), public.claim_account_deletion(), public.anonymize_account_deletion(uuid), public.run_gdpr_retention() to service_role;

insert into kinavela_private.schema_migrations(version) values ('202608110014_gdpr_hardening') on conflict (version) do nothing;
notify pgrst, 'reload schema';
commit;
