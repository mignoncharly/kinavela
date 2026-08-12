begin;

create table kinavela_private.admin_roles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  role text not null check (role in ('admin', 'moderator')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table kinavela_private.admin_feature_flags (
  flag_key text primary key check (flag_key ~ '^[a-z][a-z0-9_]{2,79}$'),
  enabled boolean not null default false,
  rollout_percent smallint not null default 100 check (rollout_percent between 0 and 100),
  description text not null default '' check (char_length(description) <= 240),
  updated_at timestamptz not null default now()
);

insert into kinavela_private.admin_feature_flags(flag_key, enabled, rollout_percent, description)
values
  ('notifications_email', false, 0, 'Transactional email delivery'),
  ('web_push_delivery', false, 0, 'Web push notification delivery'),
  ('ai_story_adaptation', false, 0, 'Child-friendly AI story adaptation'),
  ('new_matching_experience', false, 0, 'Next matching experience')
on conflict (flag_key) do nothing;

alter table kinavela_private.admin_roles enable row level security;
alter table kinavela_private.admin_roles force row level security;
alter table kinavela_private.admin_feature_flags enable row level security;
alter table kinavela_private.admin_feature_flags force row level security;
revoke all on kinavela_private.admin_roles, kinavela_private.admin_feature_flags
  from public, anon, authenticated, service_role;

create or replace function kinavela_private.is_admin(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from kinavela_private.admin_roles role_row
    join public.profiles profile_row on profile_row.id = role_row.profile_id
    where role_row.profile_id = p_profile_id
      and role_row.active
      and profile_row.status = 'active'
  )
$$;

create or replace function kinavela_private.feature_enabled(p_flag_key text, p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    flag.enabled
    and flag.rollout_percent > 0
    and (
      flag.rollout_percent = 100
      or mod(abs(hashtext(coalesce(p_profile_id::text, 'anonymous'))), 100) < flag.rollout_percent
    ),
    false
  )
  from kinavela_private.admin_feature_flags flag
  where flag.flag_key = p_flag_key
$$;

create or replace function public.get_my_admin_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role_row.role
  from kinavela_private.admin_roles role_row
  join public.profiles profile_row on profile_row.id = role_row.profile_id
  where profile_row.auth_user_id = auth.uid()
    and profile_row.status = 'active'
    and role_row.active
  limit 1
$$;

create or replace function public.is_feature_enabled(p_flag_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select kinavela_private.feature_enabled(p_flag_key, public.current_profile_id())
$$;

create or replace function public.admin_list_reports(p_status text default null, p_limit integer default 100)
returns table (
  report_id uuid,
  target_type text,
  target_family_id uuid,
  target_message_id uuid,
  target_village_id uuid,
  reason text,
  details text,
  status text,
  reporter_profile_id uuid,
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
    select report.id, report.target_type, report.target_family_id, report.target_message_id,
      report.target_village_id, report.reason, report.details, report.status,
      report.reporter_profile_id, report.created_at, report.updated_at
    from public.reports report
    where p_status is null or report.status = p_status
    order by report.created_at asc
    limit least(greatest(coalesce(p_limit, 100), 1), 200);
end;
$$;

create or replace function public.admin_set_report_status(p_report_id uuid, p_status text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_uuid uuid := public.current_profile_id();
begin
  if not kinavela_private.is_admin(actor_uuid) then raise exception 'admin_required'; end if;
  if p_status not in ('reviewing', 'resolved', 'dismissed') then raise exception 'invalid_report_status'; end if;
  update public.reports set status = p_status, updated_at = now() where id = p_report_id;
  if not found then raise exception 'report_not_found'; end if;
  insert into public.audit_events(actor_profile_id, event_type, entity_type, entity_id, metadata)
    values (actor_uuid, 'report_status_changed', 'report', p_report_id,
      jsonb_build_object('status', p_status));
  return true;
end;
$$;

create or replace function public.admin_list_users(p_limit integer default 100)
returns table (
  profile_id uuid,
  display_name text,
  status text,
  verification_level text,
  onboarding_completed boolean,
  family_count bigint,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not kinavela_private.is_admin(public.current_profile_id()) then raise exception 'admin_required'; end if;
  return query
    select profile.id, profile.display_name, profile.status, profile.verification_level,
      profile.onboarding_completed,
      (select count(*) from public.family_members member where member.profile_id = profile.id and member.status = 'active'),
      profile.created_at
    from public.profiles profile
    order by profile.created_at desc
    limit least(greatest(coalesce(p_limit, 100), 1), 200);
end;
$$;

create or replace function public.admin_list_families(p_limit integer default 100)
returns table (
  family_id uuid,
  name text,
  city text,
  country_of_residence text,
  visibility text,
  member_count bigint,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not kinavela_private.is_admin(public.current_profile_id()) then raise exception 'admin_required'; end if;
  return query
    select family.id, family.name, family.city, family.country_of_residence, family.visibility,
      (select count(*) from public.family_members member where member.family_id = family.id and member.status = 'active'),
      family.created_at
    from public.families family
    order by family.created_at desc
    limit least(greatest(coalesce(p_limit, 100), 1), 200);
end;
$$;

create or replace function public.admin_list_villages(p_limit integer default 100)
returns table (
  village_id uuid,
  name text,
  village_type text,
  city text,
  status text,
  member_count bigint,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not kinavela_private.is_admin(public.current_profile_id()) then raise exception 'admin_required'; end if;
  return query
    select village.id, village.name, village.village_type, village.city, village.status,
      (select count(*) from public.village_members member where member.village_id = village.id and member.status = 'active'),
      village.created_at
    from public.villages village
    order by village.created_at desc
    limit least(greatest(coalesce(p_limit, 100), 1), 200);
end;
$$;

create or replace function public.admin_list_events(p_limit integer default 100)
returns table (
  event_id uuid,
  village_id uuid,
  title text,
  category text,
  status text,
  starts_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not kinavela_private.is_admin(public.current_profile_id()) then raise exception 'admin_required'; end if;
  return query
    select event.id, event.village_id, event.title, event.category, event.status, event.starts_at, event.created_at
    from public.events event
    order by event.starts_at desc
    limit least(greatest(coalesce(p_limit, 100), 1), 200);
end;
$$;

create or replace function public.admin_list_ai_jobs(p_limit integer default 100)
returns table (
  job_id uuid,
  feature text,
  status text,
  moderation_status text,
  attempts smallint,
  cost_micros bigint,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not kinavela_private.is_admin(public.current_profile_id()) then raise exception 'admin_required'; end if;
  return query
    select job.id, job.feature, job.status, job.moderation_status, job.attempts,
      job.cost_micros, job.created_at, job.updated_at
    from public.ai_jobs job
    order by job.created_at desc
    limit least(greatest(coalesce(p_limit, 100), 1), 200);
end;
$$;

create or replace function public.admin_list_audit_events(p_limit integer default 100)
returns table (
  audit_id uuid,
  event_type text,
  entity_type text,
  entity_id uuid,
  actor_profile_id uuid,
  metadata jsonb,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not kinavela_private.is_admin(public.current_profile_id()) then raise exception 'admin_required'; end if;
  return query
    select audit.id, audit.event_type, audit.entity_type, audit.entity_id, audit.actor_profile_id,
      audit.metadata - array['body', 'message_body', 'email', 'auth_user_id'], audit.created_at
    from public.audit_events audit
    order by audit.created_at desc
    limit least(greatest(coalesce(p_limit, 100), 1), 200);
end;
$$;

create or replace function public.admin_list_feature_flags()
returns table (flag_key text, enabled boolean, rollout_percent smallint, description text, updated_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not kinavela_private.is_admin(public.current_profile_id()) then raise exception 'admin_required'; end if;
  return query select flag.flag_key, flag.enabled, flag.rollout_percent, flag.description, flag.updated_at
    from kinavela_private.admin_feature_flags flag order by flag.flag_key;
end;
$$;

create or replace function public.admin_set_feature_flag(
  p_flag_key text, p_enabled boolean, p_rollout_percent smallint default 100, p_description text default ''
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare actor_uuid uuid := public.current_profile_id();
begin
  if not kinavela_private.is_admin(actor_uuid) then raise exception 'admin_required'; end if;
  if p_flag_key is null or p_flag_key !~ '^[a-z][a-z0-9_]{2,79}$' then raise exception 'invalid_feature_flag'; end if;
  if p_rollout_percent not between 0 and 100 then raise exception 'invalid_rollout_percent'; end if;
  insert into kinavela_private.admin_feature_flags(flag_key, enabled, rollout_percent, description, updated_at)
    values (p_flag_key, coalesce(p_enabled, false), p_rollout_percent, left(coalesce(p_description, ''), 240), now())
    on conflict (flag_key) do update set enabled = excluded.enabled,
      rollout_percent = excluded.rollout_percent, description = excluded.description, updated_at = now();
  insert into public.audit_events(actor_profile_id, event_type, entity_type, metadata)
    values (actor_uuid, 'feature_flag_changed', 'feature_flag',
      jsonb_build_object('flag_key', p_flag_key, 'enabled', p_enabled, 'rollout_percent', p_rollout_percent));
  return true;
end;
$$;

create or replace function public.admin_suspend_profile(p_profile_id uuid, p_reason text default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare actor_uuid uuid := public.current_profile_id();
begin
  if not kinavela_private.is_admin(actor_uuid) then raise exception 'admin_required'; end if;
  if p_profile_id = actor_uuid then raise exception 'cannot_suspend_self'; end if;
  if exists (select 1 from kinavela_private.admin_roles where profile_id = p_profile_id and active) then
    raise exception 'admin_profile_protected';
  end if;
  update public.profiles set status = 'suspended', updated_at = now()
    where id = p_profile_id and status <> 'deleted';
  if not found then raise exception 'profile_not_found'; end if;
  insert into public.audit_events(actor_profile_id, event_type, entity_type, entity_id, metadata)
    values (actor_uuid, 'profile_suspended', 'profile', p_profile_id,
      jsonb_build_object('reason', left(nullif(btrim(p_reason), ''), 500)));
  return true;
end;
$$;

create or replace function public.admin_restore_profile(p_profile_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare actor_uuid uuid := public.current_profile_id();
begin
  if not kinavela_private.is_admin(actor_uuid) then raise exception 'admin_required'; end if;
  update public.profiles set status = 'active', updated_at = now()
    where id = p_profile_id and status = 'suspended';
  if not found then raise exception 'suspended_profile_not_found'; end if;
  insert into public.audit_events(actor_profile_id, event_type, entity_type, entity_id)
    values (actor_uuid, 'profile_restored', 'profile', p_profile_id);
  return true;
end;
$$;

create or replace function public.grant_admin_role(p_profile_id uuid, p_role text default 'admin')
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'service_role_required'; end if;
  if p_role not in ('admin', 'moderator') then raise exception 'invalid_admin_role'; end if;
  if not exists (select 1 from public.profiles where id = p_profile_id) then raise exception 'profile_not_found'; end if;
  insert into kinavela_private.admin_roles(profile_id, role, active, updated_at)
    values (p_profile_id, p_role, true, now())
    on conflict (profile_id) do update set role = excluded.role, active = true, updated_at = now();
  return true;
end;
$$;

revoke all on function kinavela_private.is_admin(uuid), kinavela_private.feature_enabled(text, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.get_my_admin_role(), public.is_feature_enabled(text),
  public.admin_list_reports(text, integer), public.admin_set_report_status(uuid, text),
  public.admin_list_users(integer), public.admin_list_families(integer), public.admin_list_villages(integer),
  public.admin_list_events(integer), public.admin_list_ai_jobs(integer), public.admin_list_audit_events(integer),
  public.admin_list_feature_flags(), public.admin_set_feature_flag(text, boolean, smallint, text),
  public.admin_suspend_profile(uuid, text), public.admin_restore_profile(uuid), public.grant_admin_role(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.get_my_admin_role(), public.is_feature_enabled(text) to authenticated;
grant execute on function public.admin_list_reports(text, integer), public.admin_set_report_status(uuid, text),
  public.admin_list_users(integer), public.admin_list_families(integer), public.admin_list_villages(integer),
  public.admin_list_events(integer), public.admin_list_ai_jobs(integer), public.admin_list_audit_events(integer),
  public.admin_list_feature_flags(), public.admin_set_feature_flag(text, boolean, smallint, text),
  public.admin_suspend_profile(uuid, text), public.admin_restore_profile(uuid) to authenticated;
grant execute on function public.grant_admin_role(uuid, text) to service_role;

insert into kinavela_private.schema_migrations(version)
values ('202608110009_admin_moderation')
on conflict (version) do nothing;

notify pgrst, 'reload schema';
commit;
