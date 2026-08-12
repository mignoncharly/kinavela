begin;

do $$
begin
  if exists (
    select 1
    from public.family_stories
    where original_audio_size_bytes > 25000000
  ) then
    raise exception 'existing_story_audio_exceeds_transcription_limit';
  end if;
end
$$;

alter table public.family_stories
  drop constraint if exists family_stories_original_audio_size_bytes_check;

alter table public.family_stories
  add constraint family_stories_original_audio_size_bytes_check
  check (original_audio_size_bytes between 1 and 25000000);

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
  select * into request_row
    from public.story_requests
    where token_hash = lower(p_token_hash)
    for update;
  if request_row.id is null or request_row.status <> 'active'
     or request_row.expires_at <= now() then
    raise exception 'story_link_unavailable';
  end if;
  if request_row.recording_attempts >= 3 then
    raise exception 'story_recording_rate_limited';
  end if;
  pending_uuid := coalesce(request_row.pending_upload_id, gen_random_uuid());
  update public.story_requests
    set pending_upload_id = pending_uuid
    where id = request_row.id;
  return query
    select pending_uuid, 'stories/' || pending_uuid::text || '/original',
      request_row.expires_at;
end;
$$;

create or replace function public.submit_anonymous_story(
  p_token_hash text, p_audio_path text, p_title text, p_original_language text,
  p_mime_type text, p_size_bytes bigint
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare request_row public.story_requests%rowtype; story_uuid uuid;
begin
  if p_token_hash is null or char_length(p_token_hash) <> 64 then
    raise exception 'invalid_story_link';
  end if;
  select * into request_row
    from public.story_requests
    where token_hash = lower(p_token_hash)
    for update;
  if request_row.id is null or request_row.status <> 'active'
     or request_row.expires_at <= now() then
    raise exception 'story_link_unavailable';
  end if;
  if request_row.pending_upload_id is null
     or p_audio_path <> 'stories/' || request_row.pending_upload_id::text || '/original' then
    raise exception 'invalid_story_audio_path';
  end if;
  if p_mime_type is null
     or p_mime_type not in ('audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/webm')
     or p_size_bytes is null or p_size_bytes not between 1 and 25000000 then
    raise exception 'invalid_story_audio';
  end if;
  if char_length(btrim(coalesce(p_title, ''))) not between 2 and 160 then
    raise exception 'invalid_story_title';
  end if;
  story_uuid := request_row.pending_upload_id;
  insert into public.family_stories(
    id, family_id, child_id, story_request_id, title, original_audio_path,
    original_audio_mime_type, original_audio_size_bytes, original_language
  ) values (
    story_uuid, request_row.family_id, request_row.child_id, request_row.id,
    btrim(p_title), p_audio_path, p_mime_type, p_size_bytes,
    lower(nullif(p_original_language, ''))
  );
  insert into public.story_ai_jobs(story_id, job_type)
    values (story_uuid, 'transcribe');
  update public.story_requests
    set status = 'submitted',
        submitted_at = now(),
        recording_attempts = recording_attempts + 1,
        pending_upload_id = null
    where id = request_row.id;
  return story_uuid;
end;
$$;

update storage.buckets
  set file_size_limit = 25000000
  where id = 'story-audio';

create or replace function public.claim_story_ai_job()
returns table (
  job_id uuid,
  story_id uuid,
  job_type text,
  audio_path text,
  audio_mime_type text,
  audio_size_bytes bigint,
  original_language text,
  transcript_original text,
  transcript_translation text,
  requested_translation_language text,
  request_question text,
  story_title text
)
language plpgsql security definer set search_path = '' as $$
declare job_row public.story_ai_jobs%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  update public.story_ai_jobs job
    set status = case when job.attempts >= 5 then 'failed' else 'queued' end,
        error_code = case when job.attempts >= 5 then 'worker_timeout' else null end,
        started_at = null,
        completed_at = case when job.attempts >= 5 then now() else null end
    where job.status = 'processing'
      and job.started_at < now() - interval '15 minutes';

  select job.*
    into job_row
    from public.story_ai_jobs job
    where job.status = 'queued'
      and job.attempts < 5
    order by job.created_at, job.id
    for update skip locked
    limit 1;

  if job_row.id is null then
    return;
  end if;

  update public.story_ai_jobs
    set status = 'processing', started_at = now(), completed_at = null
    where id = job_row.id;

  update public.family_stories
    set ai_status = case job_row.job_type
      when 'transcribe' then 'transcribing'
      when 'translate' then 'translating'
      when 'adapt' then 'adapting'
    end,
    updated_at = now()
    where id = job_row.story_id;

  return query
    select job_row.id, story.id, job_row.job_type, story.original_audio_path,
      story.original_audio_mime_type, story.original_audio_size_bytes,
      story.original_language, story.transcript_original,
      story.transcript_translation, request.requested_translation_language,
      request.question, story.title
    from public.family_stories story
    join public.story_requests request
      on request.id = story.story_request_id
    where story.id = job_row.story_id;
end;
$$;

create or replace function public.complete_story_ai_job(
  p_job_id uuid, p_status text, p_original_language text default null,
  p_transcript text default null, p_translation text default null,
  p_adaptation text default null, p_error_code text default null
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare job_row public.story_ai_jobs%rowtype; story_row public.family_stories%rowtype; next_type text; adaptation_requested boolean;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'service_role_required'; end if;
  select * into job_row from public.story_ai_jobs where id = p_job_id for update;
  if job_row.id is null then raise exception 'job_not_found'; end if;
  select * into story_row from public.family_stories where id = job_row.story_id;
  if p_status not in ('completed', 'failed') then raise exception 'invalid_job_status'; end if;
  if p_status = 'failed' then
    update public.story_ai_jobs set status = 'failed', error_code = left(nullif(p_error_code, ''), 80), attempts = least(attempts + 1, 5), completed_at = now() where id = p_job_id;
    update public.family_stories set ai_status = 'failed', updated_at = now() where id = story_row.id;
    return true;
  end if;
  update public.story_ai_jobs set status = 'completed', attempts = least(attempts + 1, 5), completed_at = now() where id = p_job_id;
  if job_row.job_type = 'transcribe' then
    select request.request_adaptation into adaptation_requested from public.story_requests request where request.id = story_row.story_request_id;
    if exists (select 1 from public.story_requests request where request.id = story_row.story_request_id and request.requested_translation_language is not null) then
      next_type := 'translate';
    elsif coalesce(adaptation_requested, false) then
      next_type := 'adapt';
    else
      next_type := null;
    end if;
    update public.family_stories set original_language = coalesce(nullif(p_original_language, ''), original_language), transcript_original = p_transcript, ai_status = case when next_type = 'translate' then 'translating' when next_type = 'adapt' then 'adapting' else 'ready' end, updated_at = now() where id = story_row.id;
    if next_type is not null then
      insert into public.story_ai_jobs(story_id, job_type) values (story_row.id, next_type) on conflict do nothing;
    end if;
  elsif job_row.job_type = 'translate' then
    select request.request_adaptation into adaptation_requested from public.story_requests request where request.id = story_row.story_request_id;
    update public.family_stories set transcript_translation = p_translation, ai_status = case when coalesce(adaptation_requested, false) then 'adapting' else 'ready' end, updated_at = now() where id = story_row.id;
    if coalesce(adaptation_requested, false) then
      insert into public.story_ai_jobs(story_id, job_type) values (story_row.id, 'adapt') on conflict do nothing;
    end if;
  elsif job_row.job_type = 'adapt' then
    update public.family_stories set adapted_story = p_adaptation, ai_status = 'ready', approval_status = 'pending_review', updated_at = now() where id = story_row.id;
  end if;
  return true;
end;
$$;

revoke all on function public.claim_story_ai_job()
  from public, anon, authenticated, service_role;

grant execute on function public.claim_story_ai_job()
  to service_role;

insert into kinavela_private.schema_migrations(version)
values ('202608110023_phase_e_story_adaptation_option')
on conflict (version) do nothing;

notify pgrst, 'reload schema';
commit;
