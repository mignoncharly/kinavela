begin;

alter table public.roots_passport_entries
  add column if not exists story_id uuid;

create table public.story_requests (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  created_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  token_hash text not null unique check (char_length(token_hash) = 64),
  question text not null check (char_length(btrim(question)) between 10 and 2000),
  requested_translation_language text check (requested_translation_language is null or requested_translation_language ~ '^[a-z0-9-]{2,16}$'),
  request_adaptation boolean not null default true,
  pending_upload_id uuid,
  access_window_started_at timestamptz,
  access_window_attempts smallint not null default 0 check (access_window_attempts between 0 and 30),
  recording_attempts smallint not null default 0 check (recording_attempts between 0 and 3),
  expires_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'submitted', 'revoked', 'expired')),
  submitted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check ((status = 'submitted' and submitted_at is not null) or status <> 'submitted'),
  check ((status = 'revoked' and revoked_at is not null) or status <> 'revoked')
);

create table public.family_stories (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  story_request_id uuid not null unique references public.story_requests(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 2 and 160),
  original_audio_path text not null check (char_length(original_audio_path) between 10 and 500),
  original_audio_mime_type text not null check (original_audio_mime_type in ('audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/webm')),
  original_audio_size_bytes bigint not null check (original_audio_size_bytes between 1 and 50000000),
  original_language text check (original_language is null or original_language ~ '^[a-z0-9-]{2,16}$'),
  transcript_original text,
  transcript_translation text,
  adapted_story text,
  ai_status text not null default 'queued' check (ai_status in ('queued', 'transcribing', 'translating', 'adapting', 'ready', 'failed')),
  approval_status text not null default 'pending_review' check (approval_status in ('pending_review', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.story_ai_jobs (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.family_stories(id) on delete cascade,
  job_type text not null check (job_type in ('transcribe', 'translate', 'adapt')),
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed')),
  attempts smallint not null default 0 check (attempts between 0 and 5),
  error_code text check (error_code is null or char_length(error_code) between 2 and 80),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  unique(story_id, job_type)
);

create index story_requests_family_time_idx on public.story_requests(family_id, created_at desc);
create index story_requests_expiry_idx on public.story_requests(expires_at, status);
create index family_stories_family_time_idx on public.family_stories(family_id, created_at desc);
create index story_ai_jobs_queue_idx on public.story_ai_jobs(status, created_at)
  where status in ('queued', 'processing');

alter table public.story_requests enable row level security;
alter table public.story_requests force row level security;
alter table public.family_stories enable row level security;
alter table public.family_stories force row level security;
alter table public.story_ai_jobs enable row level security;
alter table public.story_ai_jobs force row level security;
revoke all on public.story_requests, public.family_stories, public.story_ai_jobs from public, anon, authenticated;

create or replace function kinavela_private.can_manage_story_family(p_family_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.family_members member
    where member.family_id = p_family_id and member.profile_id = public.current_profile_id()
      and member.status = 'active' and member.role in ('owner', 'guardian')
  );
$$;

revoke all on function kinavela_private.can_manage_story_family(uuid)
  from public, anon, authenticated, service_role;

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
  if char_length(btrim(coalesce(p_question, ''))) not between 10 and 2000 then raise exception 'invalid_story_question'; end if;
  if p_requested_translation_language is not null and p_requested_translation_language !~ '^[a-z0-9-]{2,16}$' then raise exception 'invalid_translation_language'; end if;
  if (select count(*) from public.story_requests where family_id = family_uuid and created_at >= now() - interval '24 hours') >= 10 then raise exception 'story_request_rate_limited'; end if;
  raw_token := translate(encode(extensions.gen_random_bytes(32), 'base64'), E'+/=', '-_');
  token_digest := encode(extensions.digest(convert_to(raw_token, 'utf8'), 'sha256'), 'hex');
  insert into public.story_requests(
    id, family_id, child_id, created_by_profile_id, token_hash, question,
    requested_translation_language, request_adaptation, expires_at
  ) values (
    request_uuid, family_uuid, p_child_id, profile_uuid, token_digest, btrim(p_question),
    lower(nullif(p_requested_translation_language, '')), p_request_adaptation, expires_value
  );
  insert into public.audit_events(actor_profile_id, event_type, entity_type, entity_id)
  values (profile_uuid, 'story_request_created', 'story_request', request_uuid);
  return query select request_uuid, raw_token, expires_value;
end;
$$;

create or replace function public.list_my_story_requests()
returns table (request_id uuid, child_id uuid, child_nickname text, question text, expires_at timestamptz, status text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if public.current_profile_id() is null then raise exception 'not_authenticated'; end if;
  return query
  select request.id, request.child_id, child.nickname, request.question, request.expires_at,
    case when request.status = 'active' and request.expires_at <= now() then 'expired' else request.status end,
    request.created_at
  from public.story_requests request
  join public.children child on child.id = request.child_id
  where kinavela_private.can_manage_story_family(request.family_id)
  order by request.created_at desc;
end;
$$;

create or replace function public.list_my_family_stories()
returns table (
  story_id uuid, child_id uuid, child_nickname text, title text, original_language text,
  transcript_original text, transcript_translation text, adapted_story text, ai_status text,
  approval_status text, audio_available boolean, roots_entry_id uuid, created_at timestamptz, updated_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if public.current_profile_id() is null then raise exception 'not_authenticated'; end if;
  return query
  select story.id, story.child_id, child.nickname, story.title, story.original_language,
    story.transcript_original, story.transcript_translation, story.adapted_story,
    story.ai_status, story.approval_status, story.original_audio_path is not null,
    entry.id, story.created_at, story.updated_at
  from public.family_stories story
  join public.children child on child.id = story.child_id
  left join public.roots_passport_entries entry on entry.story_id = story.id
  where kinavela_private.can_manage_story_family(story.family_id)
  order by story.created_at desc, story.id;
end;
$$;

create or replace function public.revoke_story_request(p_request_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare profile_uuid uuid := public.current_profile_id(); family_uuid uuid;
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  select family_id into family_uuid from public.story_requests where id = p_request_id;
  if family_uuid is null or not kinavela_private.can_manage_story_family(family_uuid) then raise exception 'not_authorized'; end if;
  update public.story_requests set status = 'revoked', revoked_at = now(), pending_upload_id = null
  where id = p_request_id and status = 'active';
  insert into public.audit_events(actor_profile_id, event_type, entity_type, entity_id)
  values (profile_uuid, 'story_request_revoked', 'story_request', p_request_id);
  return found;
end;
$$;

create or replace function public.get_story_request_by_token(p_token_hash text)
returns table (request_id uuid, question text, expires_at timestamptz, can_record boolean)
language plpgsql security definer set search_path = '' as $$
declare request_row public.story_requests%rowtype;
begin
  if p_token_hash is null or char_length(p_token_hash) <> 64 then raise exception 'invalid_story_link'; end if;
  select * into request_row from public.story_requests where token_hash = lower(p_token_hash) for update;
  if request_row.id is null then raise exception 'invalid_story_link'; end if;
  if request_row.status = 'active' and request_row.expires_at <= now() then
    update public.story_requests set status = 'expired' where id = request_row.id;
    raise exception 'story_link_expired';
  end if;
  if request_row.status <> 'active' then raise exception 'story_link_unavailable'; end if;
  if request_row.access_window_started_at is null or request_row.access_window_started_at < now() - interval '1 hour' then
    update public.story_requests set access_window_started_at = now(), access_window_attempts = 1 where id = request_row.id;
  elsif request_row.access_window_attempts >= 30 then raise exception 'story_link_rate_limited';
  else update public.story_requests set access_window_attempts = access_window_attempts + 1 where id = request_row.id;
  end if;
  return query select request_row.id, request_row.question, request_row.expires_at, true;
end;
$$;

create or replace function public.prepare_story_upload(p_token_hash text, p_mime_type text, p_size_bytes bigint)
returns table (story_id uuid, upload_path text, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare request_row public.story_requests%rowtype; pending_uuid uuid;
begin
  if p_token_hash is null or char_length(p_token_hash) <> 64 or p_mime_type not in ('audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/webm') or p_size_bytes not between 1 and 50000000 then raise exception 'invalid_story_audio'; end if;
  select * into request_row from public.story_requests where token_hash = lower(p_token_hash) for update;
  if request_row.id is null or request_row.status <> 'active' or request_row.expires_at <= now() then raise exception 'story_link_unavailable'; end if;
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
  if request_row.pending_upload_id is null or p_audio_path <> 'stories/' || request_row.pending_upload_id::text || '/original' then raise exception 'invalid_story_audio_path'; end if;
  if p_mime_type not in ('audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/webm') or p_size_bytes not between 1 and 50000000 then raise exception 'invalid_story_audio'; end if;
  if char_length(btrim(coalesce(p_title, ''))) not between 2 and 160 then raise exception 'invalid_story_title'; end if;
  story_uuid := request_row.pending_upload_id;
  insert into public.family_stories(
    id, family_id, child_id, story_request_id, title, original_audio_path,
    original_audio_mime_type, original_audio_size_bytes, original_language
  ) values (
    story_uuid, request_row.family_id, request_row.child_id, request_row.id, btrim(p_title), p_audio_path,
    p_mime_type, p_size_bytes, lower(nullif(p_original_language, ''))
  );
  insert into public.story_ai_jobs(story_id, job_type) values (story_uuid, 'transcribe');
  update public.story_requests set status = 'submitted', submitted_at = now(), recording_attempts = recording_attempts + 1, pending_upload_id = null where id = request_row.id;
  return story_uuid;
end;
$$;

create or replace function public.get_story_audio_path(p_story_id uuid)
returns text language plpgsql stable security definer set search_path = '' as $$
declare path_value text; family_uuid uuid;
begin
  select story.original_audio_path, story.family_id into path_value, family_uuid from public.family_stories story where story.id = p_story_id;
  if path_value is null or not kinavela_private.can_manage_story_family(family_uuid) then raise exception 'not_authorized'; end if;
  return path_value;
end;
$$;

create or replace function public.review_family_story(p_story_id uuid, p_approval text, p_adapted_story text default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare profile_uuid uuid := public.current_profile_id(); family_uuid uuid;
begin
  if profile_uuid is null or p_approval not in ('approved', 'rejected') then raise exception 'invalid_story_review'; end if;
  select story.family_id into family_uuid from public.family_stories story where story.id = p_story_id;
  if family_uuid is null or not kinavela_private.can_manage_story_family(family_uuid) then raise exception 'not_authorized'; end if;
  if p_approval = 'approved' and not exists (select 1 from public.family_stories where id = p_story_id and ai_status = 'ready') then raise exception 'story_not_ready'; end if;
  update public.family_stories set approval_status = p_approval, adapted_story = coalesce(nullif(btrim(p_adapted_story), ''), adapted_story), updated_at = now() where id = p_story_id;
  insert into public.audit_events(actor_profile_id, event_type, entity_type, entity_id)
  values (profile_uuid, case when p_approval = 'approved' then 'story_approved' else 'story_rejected' end, 'family_story', p_story_id);
  return true;
end;
$$;

create or replace function public.create_roots_entry_from_story(p_story_id uuid, p_visibility text default 'private')
returns uuid language plpgsql security definer set search_path = '' as $$
declare story_row public.family_stories%rowtype; passport_uuid uuid; entry_uuid uuid;
begin
  select * into story_row from public.family_stories where id = p_story_id;
  if story_row.id is null or not kinavela_private.can_manage_story_family(story_row.family_id) then raise exception 'not_authorized'; end if;
  if story_row.approval_status <> 'approved' then raise exception 'story_not_approved'; end if;
  select passport.id into passport_uuid from public.roots_passports passport where passport.child_id = story_row.child_id;
  entry_uuid := public.create_roots_passport_entry(jsonb_build_object(
    'child_id', story_row.child_id, 'type', 'story', 'title', story_row.title,
    'description', coalesce(story_row.adapted_story, story_row.transcript_translation, story_row.transcript_original),
    'visibility', p_visibility
  ));
  update public.roots_passport_entries set story_id = story_row.id where id = entry_uuid;
  return entry_uuid;
end;
$$;

create or replace function public.complete_story_ai_job(
  p_job_id uuid, p_status text, p_original_language text default null,
  p_transcript text default null, p_translation text default null,
  p_adaptation text default null, p_error_code text default null
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare job_row public.story_ai_jobs%rowtype; story_row public.family_stories%rowtype; next_type text;
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
    update public.family_stories set original_language = coalesce(nullif(p_original_language, ''), original_language), transcript_original = p_transcript, ai_status = case when story_row.story_request_id is not null and exists (select 1 from public.story_requests request where request.id = story_row.story_request_id and request.requested_translation_language is not null) then 'translating' else 'adapting' end, updated_at = now() where id = story_row.id;
    next_type := case when exists (select 1 from public.story_requests request where request.id = story_row.story_request_id and request.requested_translation_language is not null) then 'translate' else 'adapt' end;
    insert into public.story_ai_jobs(story_id, job_type) values (story_row.id, next_type) on conflict do nothing;
  elsif job_row.job_type = 'translate' then
    update public.family_stories set transcript_translation = p_translation, ai_status = 'adapting', updated_at = now() where id = story_row.id;
    insert into public.story_ai_jobs(story_id, job_type) values (story_row.id, 'adapt') on conflict do nothing;
  elsif job_row.job_type = 'adapt' then
    update public.family_stories set adapted_story = p_adaptation, ai_status = 'ready', approval_status = 'pending_review', updated_at = now() where id = story_row.id;
  end if;
  return true;
end;
$$;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('story-audio', 'story-audio', false, 50000000, array['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/webm'])
on conflict (id) do update set public = false, file_size_limit = 50000000, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Story parents read audio" on storage.objects;
create policy "Story parents read audio" on storage.objects for select to authenticated
  using (bucket_id = 'story-audio' and exists (
    select 1 from public.family_stories story
    where story.original_audio_path = name and kinavela_private.can_manage_story_family(story.family_id)
  ));

revoke all on function public.create_story_request(uuid, text, text, boolean), public.list_my_story_requests(), public.list_my_family_stories(), public.revoke_story_request(uuid), public.get_story_request_by_token(text), public.prepare_story_upload(text, text, bigint), public.submit_anonymous_story(text, text, text, text, text, bigint), public.get_story_audio_path(uuid), public.review_family_story(uuid, text, text), public.create_roots_entry_from_story(uuid, text), public.complete_story_ai_job(uuid, text, text, text, text, text, text) from public, anon, service_role;
grant execute on function public.create_story_request(uuid, text, text, boolean), public.list_my_story_requests(), public.list_my_family_stories(), public.revoke_story_request(uuid), public.get_story_audio_path(uuid), public.review_family_story(uuid, text, text), public.create_roots_entry_from_story(uuid, text) to authenticated;
grant execute on function public.get_story_request_by_token(text), public.prepare_story_upload(text, text, bigint), public.submit_anonymous_story(text, text, text, text, text, bigint) to anon, authenticated;
grant execute on function public.complete_story_ai_job(uuid, text, text, text, text, text, text) to service_role;

revoke all on function public.get_story_audio_path(uuid) from anon, service_role;

insert into kinavela_private.schema_migrations(version)
values ('202608110004_roots_stories')
on conflict (version) do nothing;

notify pgrst, 'reload schema';
commit;
