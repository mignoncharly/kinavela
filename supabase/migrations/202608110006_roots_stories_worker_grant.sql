begin;

revoke all on function public.complete_story_ai_job(uuid, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.complete_story_ai_job(uuid, text, text, text, text, text, text)
  to service_role;

insert into kinavela_private.schema_migrations(version)
values ('202608110006_roots_stories_worker_grant')
on conflict (version) do nothing;

notify pgrst, 'reload schema';
commit;
