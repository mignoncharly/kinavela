begin;

alter table public.family_stories
  add column if not exists manual_retry_count smallint not null default 0
    check (manual_retry_count between 0 and 3);

create table if not exists kinavela_private.story_worker_health (
  worker_key text primary key check (worker_key = 'roots_stories'),
  last_started_at timestamptz,
  last_completed_at timestamptz,
  last_provider_error_at timestamptz,
  last_error_code text check (last_error_code is null or char_length(last_error_code) between 2 and 80),
  last_processed integer not null default 0 check (last_processed >= 0),
  last_failed integer not null default 0 check (last_failed >= 0),
  updated_at timestamptz not null default now()
);

alter table kinavela_private.story_worker_health enable row level security;
alter table kinavela_private.story_worker_health force row level security;
revoke all on kinavela_private.story_worker_health from public, anon, authenticated, service_role;

create or replace function public.record_story_worker_run(
  p_state text,
  p_processed integer default 0,
  p_failed integer default 0,
  p_error_code text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role_required';
  end if;
  if p_state not in ('started', 'completed', 'provider_unavailable', 'failed')
     or coalesce(p_processed, 0) < 0 or coalesce(p_failed, 0) < 0 then
    raise exception 'invalid_worker_state';
  end if;
  insert into kinavela_private.story_worker_health(
    worker_key, last_started_at, last_completed_at, last_provider_error_at,
    last_error_code, last_processed, last_failed, updated_at
  ) values (
    'roots_stories',
    case when p_state = 'started' then now() end,
    case when p_state = 'completed' then now() end,
    case when p_state = 'provider_unavailable' then now() end,
    left(nullif(p_error_code, ''), 80), coalesce(p_processed, 0),
    coalesce(p_failed, 0), now()
  )
  on conflict (worker_key) do update set
    last_started_at = case when p_state = 'started' then now() else kinavela_private.story_worker_health.last_started_at end,
    last_completed_at = case when p_state = 'completed' then now() else kinavela_private.story_worker_health.last_completed_at end,
    last_provider_error_at = case when p_state = 'provider_unavailable' then now() else kinavela_private.story_worker_health.last_provider_error_at end,
    last_error_code = case when p_state in ('completed', 'started') then null else left(nullif(p_error_code, ''), 80) end,
    last_processed = case when p_state = 'completed' then coalesce(p_processed, 0) else kinavela_private.story_worker_health.last_processed end,
    last_failed = case when p_state = 'completed' then coalesce(p_failed, 0) else kinavela_private.story_worker_health.last_failed end,
    updated_at = now();
  return true;
end;
$$;

create or replace function public.create_story_request(
  p_child_id uuid, p_question text, p_requested_translation_language text default null,
  p_request_adaptation boolean default true
)
returns table (request_id uuid, access_token text, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  profile_uuid uuid := public.current_profile_id();
  family_uuid uuid;
  request_uuid uuid := gen_random_uuid();
  raw_token text;
  token_digest text;
  expires_value timestamptz := now() + interval '7 days';
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  select child.family_id into family_uuid from public.children child where child.id = p_child_id;
  if family_uuid is null or not kinavela_private.can_manage_story_family(family_uuid) then raise exception 'not_authorized'; end if;
  if not kinavela_private.family_has_entitlement(family_uuid, 'roots_stories_ai') then raise exception 'premium_entitlement_required'; end if;
  if coalesce(p_request_adaptation, false)
     and not kinavela_private.feature_enabled('ai_story_adaptation', profile_uuid) then
    raise exception 'story_adaptation_unavailable';
  end if;
  if char_length(btrim(coalesce(p_question, ''))) not between 10 and 2000 then raise exception 'invalid_story_question'; end if;
  if p_requested_translation_language is not null
     and lower(p_requested_translation_language) not in ('de','en','fr','es','it','pt','wo','sw') then
    raise exception 'invalid_translation_language';
  end if;
  if (select count(*) from public.story_requests where family_id = family_uuid and created_at >= now() - interval '24 hours') >= 10 then raise exception 'story_request_rate_limited'; end if;
  raw_token := translate(encode(extensions.gen_random_bytes(32), 'base64'), E'+/=', '-_');
  token_digest := encode(extensions.digest(convert_to(raw_token, 'utf8'), 'sha256'), 'hex');
  insert into public.story_requests(
    id, family_id, child_id, created_by_profile_id, token_hash, question,
    requested_translation_language, request_adaptation, expires_at
  ) values (
    request_uuid, family_uuid, p_child_id, profile_uuid, token_digest, btrim(p_question),
    lower(nullif(p_requested_translation_language, '')), coalesce(p_request_adaptation, false), expires_value
  );
  insert into public.audit_events(actor_profile_id, event_type, entity_type, entity_id)
  values (profile_uuid, 'story_request_created', 'story_request', request_uuid);
  return query select request_uuid, raw_token, expires_value;
end;
$$;

create or replace function public.prepare_story_upload(
  p_token_hash text, p_mime_type text, p_size_bytes bigint
)
returns table (story_id uuid, upload_path text, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare request_row public.story_requests%rowtype; pending_uuid uuid;
begin
  if p_token_hash is null or char_length(p_token_hash) <> 64
     or p_mime_type is null
     or p_mime_type not in ('audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/webm')
     or p_size_bytes is null or p_size_bytes not between 1 and 25000000 then
    raise exception 'invalid_story_audio';
  end if;
  select * into request_row from public.story_requests where token_hash = lower(p_token_hash) for update;
  if request_row.id is null or request_row.status <> 'active' or request_row.expires_at <= now() then raise exception 'story_link_unavailable'; end if;
  if not kinavela_private.family_has_entitlement(request_row.family_id, 'roots_stories_ai') then raise exception 'premium_entitlement_required'; end if;
  if request_row.recording_attempts >= 3 then raise exception 'story_recording_rate_limited'; end if;
  pending_uuid := coalesce(request_row.pending_upload_id, gen_random_uuid());
  update public.story_requests set pending_upload_id = pending_uuid where id = request_row.id;
  return query select pending_uuid, 'stories/' || pending_uuid::text || '/original', request_row.expires_at;
end;
$$;

create or replace function public.submit_anonymous_story(
  p_token_hash text, p_audio_path text, p_title text, p_original_language text,
  p_mime_type text, p_size_bytes bigint
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare request_row public.story_requests%rowtype; story_uuid uuid;
begin
  if p_token_hash is null or char_length(p_token_hash) <> 64 then raise exception 'invalid_story_link'; end if;
  select * into request_row from public.story_requests where token_hash = lower(p_token_hash) for update;
  if request_row.id is null or request_row.status <> 'active' or request_row.expires_at <= now() then raise exception 'story_link_unavailable'; end if;
  if not kinavela_private.family_has_entitlement(request_row.family_id, 'roots_stories_ai') then raise exception 'premium_entitlement_required'; end if;
  if request_row.pending_upload_id is null or p_audio_path <> 'stories/' || request_row.pending_upload_id::text || '/original' then raise exception 'invalid_story_audio_path'; end if;
  if p_mime_type is null or p_mime_type not in ('audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/webm')
     or p_size_bytes is null or p_size_bytes not between 1 and 25000000 then raise exception 'invalid_story_audio'; end if;
  if char_length(btrim(coalesce(p_title, ''))) not between 2 and 160 then raise exception 'invalid_story_title'; end if;
  story_uuid := request_row.pending_upload_id;
  insert into public.family_stories(
    id, family_id, child_id, story_request_id, title, original_audio_path,
    original_audio_mime_type, original_audio_size_bytes, original_language
  ) values (
    story_uuid, request_row.family_id, request_row.child_id, request_row.id,
    btrim(p_title), p_audio_path, p_mime_type, p_size_bytes, lower(nullif(p_original_language, ''))
  );
  insert into public.story_ai_jobs(story_id, job_type) values (story_uuid, 'transcribe');
  update public.story_requests set status = 'submitted', submitted_at = now(), recording_attempts = recording_attempts + 1, pending_upload_id = null where id = request_row.id;
  return story_uuid;
end;
$$;

drop function if exists public.list_my_family_stories();
create function public.list_my_family_stories()
returns table (
  story_id uuid, child_id uuid, child_nickname text, title text, original_language text,
  transcript_original text, transcript_translation text, adapted_story text, ai_status text,
  approval_status text, audio_available boolean, roots_entry_id uuid,
  requested_translation_language text, request_adaptation boolean,
  failure_code text, retry_available boolean, created_at timestamptz, updated_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if public.current_profile_id() is null then raise exception 'not_authenticated'; end if;
  return query
  select story.id, story.child_id, child.nickname, story.title, story.original_language,
    story.transcript_original, story.transcript_translation, story.adapted_story,
    story.ai_status, story.approval_status, story.original_audio_path is not null,
    entry.id, request.requested_translation_language, request.request_adaptation,
    failed_job.error_code,
    (story.ai_status = 'failed' and story.manual_retry_count < 3),
    story.created_at, story.updated_at
  from public.family_stories story
  join public.children child on child.id = story.child_id
  join public.story_requests request on request.id = story.story_request_id
  left join public.roots_passport_entries entry on entry.story_id = story.id
  left join lateral (
    select job.error_code from public.story_ai_jobs job
    where job.story_id = story.id and job.status = 'failed'
    order by job.completed_at desc nulls last, job.created_at desc limit 1
  ) failed_job on true
  where kinavela_private.can_manage_story_family(story.family_id)
  order by story.created_at desc, story.id;
end;
$$;

create or replace function public.update_family_story_text(
  p_story_id uuid,
  p_transcript_original text,
  p_transcript_translation text default null,
  p_adapted_story text default null
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare profile_uuid uuid := public.current_profile_id(); story_row public.family_stories%rowtype;
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  select * into story_row from public.family_stories where id = p_story_id for update;
  if story_row.id is null or not kinavela_private.can_manage_story_family(story_row.family_id) then raise exception 'not_authorized'; end if;
  if story_row.approval_status <> 'pending_review' then raise exception 'story_review_complete'; end if;
  if story_row.ai_status not in ('ready', 'failed') then raise exception 'story_not_editable'; end if;
  if char_length(btrim(coalesce(p_transcript_original, ''))) not between 1 and 20000
     or char_length(coalesce(p_transcript_translation, '')) > 20000
     or char_length(coalesce(p_adapted_story, '')) > 20000 then raise exception 'invalid_story_text'; end if;
  update public.family_stories set
    transcript_original = btrim(p_transcript_original),
    transcript_translation = nullif(btrim(coalesce(p_transcript_translation, '')), ''),
    adapted_story = nullif(btrim(coalesce(p_adapted_story, '')), ''),
    ai_status = 'ready', updated_at = now()
  where id = p_story_id;
  insert into public.audit_events(actor_profile_id, event_type, entity_type, entity_id)
  values (profile_uuid, 'story_text_updated', 'family_story', p_story_id);
  return true;
end;
$$;

create or replace function public.retry_family_story(p_story_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare profile_uuid uuid := public.current_profile_id(); story_row public.family_stories%rowtype; job_uuid uuid;
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  select * into story_row from public.family_stories where id = p_story_id for update;
  if story_row.id is null or not kinavela_private.can_manage_story_family(story_row.family_id) then raise exception 'not_authorized'; end if;
  if not kinavela_private.family_has_entitlement(story_row.family_id, 'roots_stories_ai') then raise exception 'premium_entitlement_required'; end if;
  if story_row.ai_status <> 'failed' or story_row.manual_retry_count >= 3 then raise exception 'story_retry_unavailable'; end if;
  select job.id into job_uuid from public.story_ai_jobs job
    where job.story_id = p_story_id and job.status = 'failed'
    order by job.completed_at desc nulls last, job.created_at desc limit 1 for update;
  if job_uuid is null then raise exception 'story_retry_unavailable'; end if;
  update public.story_ai_jobs set status = 'queued', attempts = 0, error_code = null,
    started_at = null, completed_at = null where id = job_uuid;
  update public.family_stories set ai_status = 'queued', manual_retry_count = manual_retry_count + 1,
    updated_at = now() where id = p_story_id;
  insert into public.audit_events(actor_profile_id, event_type, entity_type, entity_id)
  values (profile_uuid, 'story_processing_retried', 'family_story', p_story_id);
  return true;
end;
$$;

create or replace function public.claim_story_ai_job()
returns table (
  job_id uuid, story_id uuid, job_type text, audio_path text, audio_mime_type text,
  audio_size_bytes bigint, original_language text, transcript_original text,
  transcript_translation text, requested_translation_language text,
  request_question text, story_title text
)
language plpgsql security definer set search_path = '' as $$
declare job_row public.story_ai_jobs%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'service_role_required'; end if;
  with timed_out as (
    update public.story_ai_jobs job set
      status = case when job.attempts >= 5 then 'failed' else 'queued' end,
      error_code = case when job.attempts >= 5 then 'worker_timeout' else null end,
      started_at = null,
      completed_at = case when job.attempts >= 5 then now() else null end
    where job.status = 'processing' and job.started_at < now() - interval '15 minutes'
    returning job.story_id, job.status
  )
  update public.family_stories story set ai_status = 'failed', updated_at = now()
  where story.id in (select timed_out.story_id from timed_out where timed_out.status = 'failed');
  select job.* into job_row from public.story_ai_jobs job
    where job.status = 'queued' and job.attempts < 5
    order by job.created_at, job.id for update skip locked limit 1;
  if job_row.id is null then return; end if;
  update public.story_ai_jobs set status = 'processing', attempts = least(attempts + 1, 5),
    started_at = now(), completed_at = null where id = job_row.id;
  update public.family_stories set ai_status = case job_row.job_type
    when 'transcribe' then 'transcribing' when 'translate' then 'translating' when 'adapt' then 'adapting' end,
    updated_at = now() where id = job_row.story_id;
  return query select job_row.id, story.id, job_row.job_type, story.original_audio_path,
    story.original_audio_mime_type, story.original_audio_size_bytes, story.original_language,
    story.transcript_original, story.transcript_translation, request.requested_translation_language,
    request.question, story.title
  from public.family_stories story join public.story_requests request on request.id = story.story_request_id
  where story.id = job_row.story_id;
end;
$$;

create or replace function public.complete_story_ai_job(
  p_job_id uuid, p_status text, p_original_language text default null,
  p_transcript text default null, p_translation text default null,
  p_adaptation text default null, p_error_code text default null
)
returns boolean language plpgsql security definer set search_path = '' as $$ 
declare job_row public.story_ai_jobs%rowtype; story_row public.family_stories%rowtype;
  request_row public.story_requests%rowtype; next_type text; adaptation_enabled boolean;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'service_role_required'; end if;
  select * into job_row from public.story_ai_jobs where id = p_job_id for update;
  if job_row.id is null then raise exception 'job_not_found'; end if;
  select * into story_row from public.family_stories where id = job_row.story_id;
  select * into request_row from public.story_requests where id = story_row.story_request_id;
  if p_status not in ('completed', 'failed') then raise exception 'invalid_job_status'; end if;
  if p_status = 'failed' then
    update public.story_ai_jobs set status = 'failed', error_code = left(coalesce(nullif(p_error_code, ''), 'ai_processing_failed'), 80), completed_at = now() where id = p_job_id;
    update public.family_stories set ai_status = 'failed', updated_at = now() where id = story_row.id;
    return true;
  end if;
  update public.story_ai_jobs set status = 'completed', error_code = null, completed_at = now() where id = p_job_id;
  adaptation_enabled := request_row.request_adaptation
    and kinavela_private.feature_enabled('ai_story_adaptation', request_row.created_by_profile_id);
  if job_row.job_type = 'transcribe' then
    if request_row.requested_translation_language is not null then next_type := 'translate';
    elsif adaptation_enabled then next_type := 'adapt'; else next_type := null; end if;
    update public.family_stories set original_language = coalesce(nullif(p_original_language, ''), original_language),
      transcript_original = p_transcript,
      ai_status = case when next_type = 'translate' then 'translating' when next_type = 'adapt' then 'adapting' else 'ready' end,
      updated_at = now() where id = story_row.id;
  elsif job_row.job_type = 'translate' then
    next_type := case when adaptation_enabled then 'adapt' else null end;
    update public.family_stories set transcript_translation = p_translation,
      ai_status = case when next_type = 'adapt' then 'adapting' else 'ready' end,
      updated_at = now() where id = story_row.id;
  elsif job_row.job_type = 'adapt' then
    next_type := null;
    update public.family_stories set adapted_story = p_adaptation, ai_status = 'ready',
      approval_status = 'pending_review', updated_at = now() where id = story_row.id;
  end if;
  if next_type is not null then
    insert into public.story_ai_jobs(story_id, job_type) values (story_row.id, next_type)
    on conflict (story_id, job_type) do update set status = 'queued', attempts = 0,
      error_code = null, started_at = null, completed_at = null;
  end if;
  return true;
end;
$$;

revoke all on function public.record_story_worker_run(text, integer, integer, text),
  public.update_family_story_text(uuid, text, text, text), public.retry_family_story(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.record_story_worker_run(text, integer, integer, text) to service_role;
grant execute on function public.update_family_story_text(uuid, text, text, text),
  public.retry_family_story(uuid), public.list_my_family_stories() to authenticated;

insert into kinavela_private.schema_migrations(version)
values ('202608130018_harden_roots_stories')
on conflict (version) do nothing;

notify pgrst, 'reload schema';
commit;
