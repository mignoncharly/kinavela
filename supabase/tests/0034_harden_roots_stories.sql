\set ON_ERROR_STOP on
begin;

do $$
declare source text;
begin
  select pg_get_functiondef('public.create_story_request(uuid,text,text,boolean)'::regprocedure)
    into source;
  if source not like '%premium_entitlement_required%'
     or source not like '%ai_story_adaptation%'
     or source not like '%invalid_translation_language%' then
    raise exception 'Story requests must enforce premium, feature-flag, and language availability';
  end if;

  select pg_get_functiondef('public.prepare_story_upload(text,text,bigint)'::regprocedure)
    into source;
  if source not like '%premium_entitlement_required%' then
    raise exception 'Anonymous uploads must recheck premium entitlement before storage';
  end if;

  select pg_get_functiondef('public.claim_story_ai_job()'::regprocedure)
    into source;
  if source not like '%attempts = least(attempts + 1, 5)%'
     or source not like '%worker_timeout%' then
    raise exception 'Story worker must count claims and surface terminal timeouts';
  end if;
end
$$;

do $$
begin
  if has_table_privilege('authenticated', 'kinavela_private.story_worker_health', 'select')
     or has_table_privilege('anon', 'kinavela_private.story_worker_health', 'select') then
    raise exception 'Story worker health must remain private';
  end if;
  if has_function_privilege('authenticated', 'public.record_story_worker_run(text,integer,integer,text)', 'execute')
     or not has_function_privilege('service_role', 'public.record_story_worker_run(text,integer,integer,text)', 'execute') then
    raise exception 'Story worker health grants are incorrect';
  end if;
  if not has_function_privilege('authenticated', 'public.update_family_story_text(uuid,text,text,text)', 'execute')
     or not has_function_privilege('authenticated', 'public.retry_family_story(uuid)', 'execute') then
    raise exception 'Guardian story edit and retry functions must be available';
  end if;
end
$$;

do $$
declare source text;
begin
  select pg_get_functiondef('public.update_family_story_text(uuid,text,text,text)'::regprocedure)
    into source;
  if source not like '%can_manage_story_family%'
     or source not like '%pending_review%'
     or source not like '%story_text_updated%' then
    raise exception 'Story text editing must be guardian-only, pre-approval, and audited';
  end if;

  select pg_get_functiondef('public.retry_family_story(uuid)'::regprocedure)
    into source;
  if source not like '%manual_retry_count >= 3%'
     or source not like '%premium_entitlement_required%' then
    raise exception 'Story retries must be bounded and entitled';
  end if;
end
$$;

rollback;
