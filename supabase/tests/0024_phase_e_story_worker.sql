\set ON_ERROR_STOP on
begin;

do $$
declare forced_rls_count integer;
begin
  select count(*) into forced_rls_count
  from pg_class relation
  join pg_namespace namespace on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relname in ('story_requests', 'family_stories', 'story_ai_jobs')
    and relation.relrowsecurity
    and relation.relforcerowsecurity;
  if forced_rls_count <> 3 then
    raise exception 'Story worker tables must use forced RLS';
  end if;
end
$$;

do $$
begin
  if has_table_privilege('anon', 'public.story_ai_jobs', 'select')
     or has_table_privilege('authenticated', 'public.story_ai_jobs', 'select') then
    raise exception 'Story worker queue must remain RPC-only';
  end if;
  if has_function_privilege(
       'authenticated', 'public.claim_story_ai_job()', 'execute'
     )
     or not has_function_privilege(
       'service_role', 'public.claim_story_ai_job()', 'execute'
     )
     or not has_function_privilege(
       'service_role',
       'public.complete_story_ai_job(uuid,text,text,text,text,text,text)',
       'execute'
     ) then
    raise exception 'Story worker grants are incorrect';
  end if;
end
$$;

do $$
declare bucket_limit bigint;
begin
  select file_size_limit into bucket_limit
    from storage.buckets
    where id = 'story-audio' and not public;
  if bucket_limit <> 25000000 then
    raise exception 'Story audio bucket must use the transcription size limit';
  end if;
  if pg_get_function_result('public.claim_story_ai_job()'::regprocedure)
       ~* '(family_id|token_hash|child_id)' then
    raise exception 'Story worker claim exposes unrelated identity fields';
  end if;
end
$$;

do $$
declare function_source text;
begin
  select pg_get_functiondef('public.complete_story_ai_job(uuid,text,text,text,text,text,text)'::regprocedure) into function_source;
  if function_source not like '%request_adaptation%' or function_source not like '%next_type := null%' then
    raise exception 'Story adaptation opt-out must be honored by completion';
  end if;
end
$$;

rollback;
