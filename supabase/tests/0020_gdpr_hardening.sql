begin;

do $$
declare
  forced boolean;
  bucket_public boolean;
begin
  select relforcerowsecurity into forced from pg_class where oid = 'public.personal_data_exports'::regclass;
  if not forced then raise exception 'personal data exports must use forced RLS'; end if;
  select public into bucket_public from storage.buckets where id = 'privacy-exports';
  if bucket_public is distinct from false then raise exception 'privacy exports bucket must be private'; end if;
  if (select count(*) from kinavela_private.processing_activities) < 7 then raise exception 'processing inventory incomplete'; end if;
  if (select count(*) from kinavela_private.retention_policies) < 7 then raise exception 'retention inventory incomplete'; end if;
  if has_table_privilege('anon', 'public.personal_data_exports', 'select') then raise exception 'anon can read exports'; end if;
  if has_table_privilege('authenticated', 'public.personal_data_exports', 'select') then raise exception 'authenticated can read export rows'; end if;
  if has_function_privilege('authenticated', 'public.get_personal_data_export_payload(uuid)', 'execute') then raise exception 'authenticated can call sensitive export payload'; end if;
  if not has_function_privilege('authenticated', 'public.request_personal_data_export()', 'execute') then raise exception 'authenticated cannot request export'; end if;
  if not has_function_privilege('service_role', 'public.claim_account_deletion()', 'execute') then raise exception 'service role cannot claim deletion'; end if;
end $$;

rollback;
