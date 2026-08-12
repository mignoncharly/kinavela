begin;

create table kinavela_private.ai_feature_quotas (
  feature text primary key,
  monthly_jobs integer not null check (monthly_jobs between 1 and 1000),
  monthly_cost_micros bigint not null check (monthly_cost_micros between 1 and 1000000000)
);

insert into kinavela_private.ai_feature_quotas(feature, monthly_jobs, monthly_cost_micros)
values
  ('story_transcription', 30, 5000000),
  ('story_translation', 30, 5000000),
  ('story_adaptation', 30, 5000000),
  ('cultural_activity_ideas', 20, 2000000),
  ('mission_draft', 10, 1000000),
  ('event_description', 10, 1000000)
on conflict (feature) do update set monthly_jobs = excluded.monthly_jobs, monthly_cost_micros = excluded.monthly_cost_micros;

create table kinavela_private.ai_prompt_versions (
  feature text not null,
  version text not null,
  template text not null check (char_length(template) between 1 and 20000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (feature, version)
);

insert into kinavela_private.ai_prompt_versions(feature, version, template)
values
  ('story_transcription', 'story-transcription-v1', 'Transcribe the supplied family story audio. Preserve uncertainty and do not invent words.'),
  ('story_translation', 'story-translation-v1', 'Translate the supplied family story faithfully. Preserve names and uncertainty.'),
  ('story_adaptation', 'story-adaptation-v1', 'Create a child-friendly adaptation of the approved family story without inventing cultural facts.'),
  ('cultural_activity_ideas', 'cultural-activity-v1', 'Suggest reviewable, respectful cultural activity ideas from the supplied family context.'),
  ('mission_draft', 'mission-draft-v1', 'Draft a reviewable family mission from the supplied cultural context.'),
  ('event_description', 'event-description-v1', 'Draft a factual, reviewable description for the supplied family event.')
on conflict (feature, version) do nothing;

create table kinavela_private.ai_quota_state (
  family_id uuid not null references public.families(id) on delete cascade,
  feature text not null references kinavela_private.ai_feature_quotas(feature) on delete restrict,
  period_start date not null,
  jobs_reserved integer not null default 0 check (jobs_reserved >= 0),
  cost_micros bigint not null default 0 check (cost_micros >= 0),
  primary key (family_id, feature, period_start)
);

create table public.ai_jobs (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  created_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  feature text not null references kinavela_private.ai_feature_quotas(feature) on delete restrict,
  subject_type text not null check (subject_type ~ '^[a-z][a-z0-9_]{1,40}$'),
  subject_id uuid,
  locale text not null check (locale in ('de', 'en', 'fr')),
  prompt_version text not null,
  input_context jsonb not null default '{}'::jsonb check (jsonb_typeof(input_context) = 'object' and pg_column_size(input_context) <= 16000),
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed')),
  attempts smallint not null default 0 check (attempts between 0 and 5),
  provider text,
  model text,
  input_tokens integer check (input_tokens is null or input_tokens between 0 and 1000000),
  output_tokens integer check (output_tokens is null or output_tokens between 0 and 1000000),
  cost_micros bigint check (cost_micros is null or cost_micros between 0 and 1000000000),
  output jsonb,
  moderation_status text not null default 'pending_review' check (moderation_status in ('pending_review', 'flagged', 'approved', 'rejected')),
  error_code text check (error_code is null or error_code ~ '^[a-z0-9_]{2,80}$'),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, feature),
  foreign key (feature, prompt_version) references kinavela_private.ai_prompt_versions(feature, version)
);

create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.ai_jobs(id) on delete restrict,
  family_id uuid not null references public.families(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  feature text not null,
  input_tokens integer not null default 0 check (input_tokens between 0 and 1000000),
  output_tokens integer not null default 0 check (output_tokens between 0 and 1000000),
  cost_micros bigint not null default 0 check (cost_micros between 0 and 1000000000),
  created_at timestamptz not null default now()
);

create index ai_jobs_queue_idx on public.ai_jobs(status, created_at)
  where status in ('queued', 'processing');
create index ai_jobs_family_idx on public.ai_jobs(family_id, created_at desc);
create index ai_usage_family_period_idx on public.ai_usage(family_id, feature, created_at desc);

alter table public.ai_jobs enable row level security;
alter table public.ai_jobs force row level security;
alter table public.ai_usage enable row level security;
alter table public.ai_usage force row level security;
revoke all on public.ai_jobs, public.ai_usage from public, anon, authenticated;
revoke all on kinavela_private.ai_feature_quotas, kinavela_private.ai_prompt_versions, kinavela_private.ai_quota_state from public, anon, authenticated, service_role;

create or replace function public.create_ai_job(
  p_feature text, p_subject_type text, p_subject_id uuid, p_locale text,
  p_prompt_version text, p_input_context jsonb default '{}'::jsonb
)
returns table (job_id uuid, quota_remaining integer)
language plpgsql security definer set search_path = '' as $$
declare
  profile_uuid uuid := public.current_profile_id();
  family_uuid uuid;
  quota_row kinavela_private.ai_feature_quotas%rowtype;
  state_row kinavela_private.ai_quota_state%rowtype;
  period_value date := date_trunc('month', now())::date;
  job_uuid uuid := gen_random_uuid();
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  select member.family_id into family_uuid from public.family_members member
    where member.profile_id = profile_uuid and member.status = 'active' and member.role in ('owner', 'guardian') limit 1;
  if family_uuid is null then raise exception 'not_authorized'; end if;
  select * into quota_row from kinavela_private.ai_feature_quotas where feature = p_feature;
  if quota_row.feature is null then raise exception 'invalid_ai_feature'; end if;
  if p_prompt_version is null or not exists (
    select 1 from kinavela_private.ai_prompt_versions prompt
    where prompt.feature = p_feature and prompt.version = p_prompt_version and prompt.active
  ) then raise exception 'invalid_ai_prompt_version'; end if;
  if p_locale not in ('de', 'en', 'fr') then raise exception 'invalid_ai_locale'; end if;
  if p_subject_type is null or p_subject_type !~ '^[a-z][a-z0-9_]{1,40}$' then raise exception 'invalid_ai_subject'; end if;
  if jsonb_typeof(coalesce(p_input_context, '{}'::jsonb)) <> 'object' or pg_column_size(coalesce(p_input_context, '{}'::jsonb)) > 16000 then raise exception 'invalid_ai_context'; end if;
  insert into kinavela_private.ai_quota_state(family_id, feature, period_start)
    values (family_uuid, p_feature, period_value) on conflict do nothing;
  select * into state_row from kinavela_private.ai_quota_state
    where family_id = family_uuid and feature = p_feature and period_start = period_value for update;
  if state_row.jobs_reserved >= quota_row.monthly_jobs then raise exception 'ai_quota_exceeded'; end if;
  update kinavela_private.ai_quota_state set jobs_reserved = jobs_reserved + 1
    where family_id = family_uuid and feature = p_feature and period_start = period_value;
  insert into public.ai_jobs(id, family_id, created_by_profile_id, feature, subject_type, subject_id, locale, prompt_version, input_context)
    values (job_uuid, family_uuid, profile_uuid, p_feature, p_subject_type, p_subject_id, p_locale, p_prompt_version, coalesce(p_input_context, '{}'::jsonb));
  insert into public.audit_events(actor_profile_id, event_type, entity_type, entity_id)
    values (profile_uuid, 'ai_job_created', 'ai_job', job_uuid);
  return query select job_uuid, quota_row.monthly_jobs - state_row.jobs_reserved - 1;
end;
$$;

create or replace function public.list_my_ai_jobs()
returns table (job_id uuid, feature text, subject_type text, subject_id uuid, locale text, prompt_version text, status text, moderation_status text, output jsonb, created_at timestamptz, updated_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare profile_uuid uuid := public.current_profile_id();
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  return query select job.id, job.feature, job.subject_type, job.subject_id, job.locale, job.prompt_version,
    job.status, job.moderation_status, job.output, job.created_at, job.updated_at
    from public.ai_jobs job where job.created_by_profile_id = profile_uuid order by job.created_at desc;
end;
$$;

create or replace function public.get_my_ai_quota()
returns table (feature text, monthly_jobs integer, jobs_reserved integer, quota_remaining integer, period_start date)
language sql stable security definer set search_path = '' as $$
  select quota.feature, quota.monthly_jobs, coalesce(state.jobs_reserved, 0), quota.monthly_jobs - coalesce(state.jobs_reserved, 0), date_trunc('month', now())::date
  from kinavela_private.ai_feature_quotas quota
  left join kinavela_private.ai_quota_state state on state.feature = quota.feature and state.period_start = date_trunc('month', now())::date
    and exists (select 1 from public.family_members member where member.family_id = state.family_id and member.profile_id = public.current_profile_id() and member.status = 'active')
  order by quota.feature;
$$;

create or replace function public.claim_ai_job()
returns table (job_id uuid, feature text, locale text, prompt_version text, input_context jsonb)
language plpgsql security definer set search_path = '' as $$
declare job_row public.ai_jobs%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'service_role_required'; end if;
  update public.ai_jobs set status = case when attempts >= 5 then 'failed' else 'queued' end,
    error_code = case when attempts >= 5 then 'worker_timeout' else error_code end, updated_at = now()
    where status = 'processing' and started_at < now() - interval '15 minutes';
  select * into job_row from public.ai_jobs where status = 'queued' and attempts < 5 order by created_at, id for update skip locked limit 1;
  if job_row.id is null then return; end if;
  update public.ai_jobs set status = 'processing', attempts = attempts + 1, started_at = now(), updated_at = now() where id = job_row.id;
  return query select job_row.id, job_row.feature, job_row.locale, job_row.prompt_version, job_row.input_context;
end;
$$;

create or replace function public.complete_ai_job(
  p_job_id uuid, p_status text, p_provider text default null, p_model text default null,
  p_input_tokens integer default 0, p_output_tokens integer default 0, p_cost_micros bigint default 0,
  p_output jsonb default null, p_moderation_status text default 'pending_review', p_error_code text default null
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare job_row public.ai_jobs%rowtype; quota_row kinavela_private.ai_feature_quotas%rowtype; used_cost bigint;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'service_role_required'; end if;
  if p_status not in ('completed', 'failed') then raise exception 'invalid_ai_job_status'; end if;
  if p_moderation_status not in ('pending_review', 'flagged', 'rejected') then raise exception 'invalid_ai_moderation_status'; end if;
  select * into job_row from public.ai_jobs where id = p_job_id for update;
  if job_row.id is null then raise exception 'ai_job_not_found'; end if;
  if job_row.status not in ('processing', 'queued') then raise exception 'ai_job_not_active'; end if;
  if p_status = 'failed' then
    update public.ai_jobs set status = 'failed', error_code = left(nullif(p_error_code, ''), 80), completed_at = now(), updated_at = now() where id = p_job_id;
    return true;
  end if;
  if p_input_tokens not between 0 and 1000000 or p_output_tokens not between 0 and 1000000 or p_cost_micros not between 0 and 1000000000 then raise exception 'invalid_ai_usage'; end if;
  select * into quota_row from kinavela_private.ai_feature_quotas where feature = job_row.feature;
  select coalesce(sum(cost_micros), 0) into used_cost from public.ai_usage where family_id = job_row.family_id and feature = job_row.feature and created_at >= date_trunc('month', now());
  if used_cost + p_cost_micros > quota_row.monthly_cost_micros then
    update public.ai_jobs set status = 'failed', error_code = 'ai_cost_quota_exceeded', completed_at = now(), updated_at = now() where id = p_job_id;
    return true;
  end if;
  update public.ai_jobs set status = 'completed', provider = left(nullif(p_provider, ''), 80), model = left(nullif(p_model, ''), 120), input_tokens = p_input_tokens, output_tokens = p_output_tokens, cost_micros = p_cost_micros, output = p_output, moderation_status = p_moderation_status, error_code = null, completed_at = now(), updated_at = now() where id = p_job_id;
  insert into public.ai_usage(job_id, family_id, profile_id, feature, input_tokens, output_tokens, cost_micros)
    values (job_row.id, job_row.family_id, job_row.created_by_profile_id, job_row.feature, p_input_tokens, p_output_tokens, p_cost_micros);
  update kinavela_private.ai_quota_state set cost_micros = cost_micros + p_cost_micros
    where family_id = job_row.family_id and feature = job_row.feature and period_start = date_trunc('month', now())::date;
  return true;
end;
$$;

create or replace function public.review_ai_job(p_job_id uuid, p_moderation_status text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare profile_uuid uuid := public.current_profile_id(); job_family uuid;
begin
  if profile_uuid is null or p_moderation_status not in ('approved', 'rejected') then raise exception 'invalid_ai_review'; end if;
  select family_id into job_family from public.ai_jobs where id = p_job_id;
  if job_family is null or not exists (select 1 from public.family_members member where member.family_id = job_family and member.profile_id = profile_uuid and member.status = 'active' and member.role in ('owner', 'guardian')) then raise exception 'not_authorized'; end if;
  update public.ai_jobs set moderation_status = p_moderation_status, updated_at = now() where id = p_job_id and status = 'completed';
  if not found then raise exception 'ai_job_not_reviewable'; end if;
  insert into public.audit_events(actor_profile_id, event_type, entity_type, entity_id)
    values (profile_uuid, case when p_moderation_status = 'approved' then 'ai_output_approved' else 'ai_output_rejected' end, 'ai_job', p_job_id);
  return true;
end;
$$;

revoke all on function public.create_ai_job(text, text, uuid, text, text, jsonb), public.list_my_ai_jobs(), public.get_my_ai_quota(), public.claim_ai_job(), public.complete_ai_job(uuid, text, text, text, integer, integer, bigint, jsonb, text, text), public.review_ai_job(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.create_ai_job(text, text, uuid, text, text, jsonb), public.list_my_ai_jobs(), public.get_my_ai_quota(), public.review_ai_job(uuid, text) to authenticated;
grant execute on function public.claim_ai_job(), public.complete_ai_job(uuid, text, text, text, integer, integer, bigint, jsonb, text, text) to service_role;

insert into kinavela_private.schema_migrations(version)
values ('202608110007_ai_layer')
on conflict (version) do nothing;

notify pgrst, 'reload schema';
commit;
