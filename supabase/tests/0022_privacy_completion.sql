begin;
do $test$
declare
  child_policy text;
begin
  if not exists (select 1 from kinavela_private.schema_migrations where version = '202608110024_privacy_retention_completion') then raise exception 'retention migration missing'; end if;
  if not exists (select 1 from kinavela_private.schema_migrations where version = '202608110025_child_privacy_rls') then raise exception 'child RLS migration missing'; end if;
  select pg_get_expr(policy.polqual, policy.polrelid) into child_policy
  from pg_policy policy join pg_class relation on relation.oid = policy.polrelid join pg_namespace namespace on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public' and relation.relname = 'children' and policy.polname = 'Guardians read children';
  if child_policy is null or child_policy !~* 'owner' or child_policy !~* 'guardian' then raise exception 'child read policy is not guardian restricted'; end if;
  if exists (select 1 from storage.buckets where id in ('roots-media', 'story-audio', 'privacy-exports') and public is true) then raise exception 'privacy storage bucket is public'; end if;
  if not exists (select 1 from pg_proc proc join pg_namespace namespace on namespace.oid = proc.pronamespace where namespace.nspname = 'public' and proc.proname = 'run_gdpr_retention') then raise exception 'retention function missing'; end if;
end;
$test$;
rollback;