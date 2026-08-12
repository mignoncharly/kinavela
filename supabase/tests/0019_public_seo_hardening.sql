\set ON_ERROR_STOP on
begin;

do $$
declare forced_rls boolean;
begin
  select relation.relrowsecurity and relation.relforcerowsecurity into forced_rls
  from pg_class relation
  join pg_namespace namespace on namespace.oid = relation.relnamespace
  where namespace.nspname = 'kinavela_private' and relation.relname = 'public_seo_pages';
  if not coalesce(forced_rls, false) then raise exception 'SEO configuration must use forced RLS'; end if;
end
$$;

rollback;
