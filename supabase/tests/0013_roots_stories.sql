\set ON_ERROR_STOP on
begin;

do $$
declare
  forced_rls_count integer;
begin
  select count(*) into forced_rls_count
  from pg_class relation
  join pg_namespace namespace on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relname in ('story_requests', 'family_stories', 'story_ai_jobs')
    and relation.relrowsecurity and relation.relforcerowsecurity;
  if forced_rls_count <> 3 then raise exception 'Story tables must use forced RLS'; end if;
end
$$;

do $$
begin
  if has_table_privilege('anon', 'public.story_requests', 'select')
     or has_table_privilege('authenticated', 'public.story_requests', 'select')
     or has_table_privilege('authenticated', 'public.family_stories', 'select')
     or has_table_privilege('authenticated', 'public.story_ai_jobs', 'select') then
    raise exception 'Story tables must remain RPC-only';
  end if;
  if not has_function_privilege('anon', 'public.get_story_request_by_token(text)', 'execute')
     or not has_function_privilege('anon', 'public.prepare_story_upload(text,text,bigint)', 'execute')
     or not has_function_privilege('anon', 'public.submit_anonymous_story(text,text,text,text,text,bigint)', 'execute') then
    raise exception 'Anonymous recording RPC grants are missing';
  end if;
  if has_function_privilege('anon', 'public.list_my_story_requests()', 'execute')
     or has_function_privilege('authenticated', 'public.complete_story_ai_job(uuid,text,text,text,text,text,text)', 'execute') then
    raise exception 'Story authorization grants are too broad';
  end if;
  if not has_function_privilege('service_role', 'public.complete_story_ai_job(uuid,text,text,text,text,text,text)', 'execute') then
    raise exception 'AI worker RPC grant is missing';
  end if;
end
$$;

do $$
begin
  if pg_get_function_result('public.list_my_story_requests()'::regprocedure)
       ~* '(access_token|token_hash|audio_path|family_id|email|birth_year|birth_month)' then
    raise exception 'Story request projection exposes secret or family fields';
  end if;
  if pg_get_function_result('public.list_my_family_stories()'::regprocedure)
       ~* '(audio_path|token_hash|family_id|email|birth_year|birth_month)' then
    raise exception 'Family story projection exposes secret or family fields';
  end if;
  if pg_get_function_result('public.get_story_request_by_token(text)'::regprocedure)
       ~* '(family_id|child_id|child_nickname|token_hash|audio_path)' then
    raise exception 'Anonymous story projection exposes identity or storage fields';
  end if;
  if pg_get_function_result('public.create_story_request(uuid,text,text,boolean)'::regprocedure)
       !~* 'access_token' then
    raise exception 'Parent story request RPC must return the one-time token';
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from storage.buckets where id = 'story-audio' and not public) then
    raise exception 'Story audio bucket must remain private';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.roots_passport_entries'::regclass
      and conname = 'roots_passport_entries_story_id_fkey'
  ) then
    raise exception 'Roots entries must reference family stories safely';
  end if;
end
$$;

rollback;
