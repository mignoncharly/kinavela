begin;

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
    entry.id, request.requested_translation_language,
    (request.request_adaptation and kinavela_private.feature_enabled(
      'ai_story_adaptation', request.created_by_profile_id
    )),
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

revoke all on function public.list_my_family_stories()
  from public, anon, authenticated, service_role;
grant execute on function public.list_my_family_stories() to authenticated;

insert into kinavela_private.schema_migrations(version)
values ('202608130019_roots_story_adaptation_projection')
on conflict (version) do nothing;

notify pgrst, 'reload schema';
commit;
