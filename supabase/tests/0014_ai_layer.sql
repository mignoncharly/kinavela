\set ON_ERROR_STOP on
begin;

do $$
declare forced_rls_count integer;
begin
  select count(*) into forced_rls_count
  from pg_class relation
  join pg_namespace namespace on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relname in ('ai_jobs', 'ai_usage')
    and relation.relrowsecurity and relation.relforcerowsecurity;
  if forced_rls_count <> 2 then raise exception 'AI public tables must use forced RLS'; end if;
end
$$;

do $$
begin
  if has_table_privilege('anon', 'public.ai_jobs', 'select')
     or has_table_privilege('authenticated', 'public.ai_jobs', 'select')
     or has_table_privilege('authenticated', 'public.ai_usage', 'select') then
    raise exception 'AI tables must remain RPC-only';
  end if;
  if not has_function_privilege('authenticated', 'public.create_ai_job(text,text,uuid,text,text,jsonb)', 'execute')
     or not has_function_privilege('authenticated', 'public.review_ai_job(uuid,text)', 'execute') then
    raise exception 'Parent AI RPC grants are missing';
  end if;
  if has_function_privilege('anon', 'public.create_ai_job(text,text,uuid,text,text,jsonb)', 'execute')
     or has_function_privilege('authenticated', 'public.claim_ai_job()', 'execute')
     or has_function_privilege('authenticated', 'public.complete_ai_job(uuid,text,text,text,integer,integer,bigint,jsonb,text,text)', 'execute') then
    raise exception 'AI worker grants are too broad';
  end if;
  if not has_function_privilege('service_role', 'public.claim_ai_job()', 'execute')
     or not has_function_privilege('service_role', 'public.complete_ai_job(uuid,text,text,text,integer,integer,bigint,jsonb,text,text)', 'execute') then
    raise exception 'AI worker grants are missing';
  end if;
end
$$;

do $$
begin
  if pg_get_function_result('public.list_my_ai_jobs()'::regprocedure) ~* '(input_context|provider|model|cost_micros)' then
    raise exception 'AI parent projection exposes worker or prompt internals';
  end if;
  if pg_get_function_result('public.get_my_ai_quota()'::regprocedure) ~* '(family_id|cost_micros)' then
    raise exception 'AI quota projection exposes private identifiers';
  end if;
  if not exists (select 1 from kinavela_private.ai_prompt_versions where feature = 'story_adaptation' and version = 'story-adaptation-v1' and active) then
    raise exception 'Versioned AI prompts are missing';
  end if;
end
$$;

rollback;
