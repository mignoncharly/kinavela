\set ON_ERROR_STOP on
begin;

do $$
declare
  page_count integer;
begin
  select count(*) into page_count from kinavela_private.public_seo_pages where active;
  if page_count <> 5 then raise exception 'Expected five controlled public SEO pages'; end if;
  if not has_function_privilege('anon', 'public.get_public_community_aggregate(text)', 'execute') then
    raise exception 'Public aggregate RPC grant is missing';
  end if;
  if has_table_privilege('anon', 'kinavela_private.public_seo_pages', 'select')
     or has_table_privilege('authenticated', 'kinavela_private.public_seo_pages', 'select') then
    raise exception 'SEO page configuration must remain private';
  end if;
end
$$;

do $$
begin
  if pg_get_function_result('public.get_public_community_aggregate(text)'::regprocedure) ~* '(family_id|profile_id|child|location|coordinate|email|auth_user)' then
    raise exception 'Public aggregate projection exposes identity or location data';
  end if;
  if pg_get_function_result('public.get_public_community_aggregate(text)'::regprocedure) !~* '(family_count|village_count|event_count|published)' then
    raise exception 'Public aggregate projection is missing privacy-safe counters';
  end if;
end
$$;

rollback;
