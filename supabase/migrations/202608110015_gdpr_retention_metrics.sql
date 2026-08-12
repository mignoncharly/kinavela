begin;

create or replace function public.run_gdpr_retention()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  outbox_deleted bigint;
  events_deleted bigint;
  requests_deleted bigint;
  exports_expired bigint;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'service_role_required'; end if;
  delete from public.notification_outbox where created_at < now() - interval '30 days';
  get diagnostics outbox_deleted = row_count;
  delete from public.notification_events where created_at < now() - interval '365 days';
  get diagnostics events_deleted = row_count;
  delete from public.account_deletion_requests where status = 'completed' and completed_at < now() - interval '90 days';
  get diagnostics requests_deleted = row_count;
  update public.personal_data_exports set status = 'expired', file_path = null, updated_at = now() where status = 'ready' and expires_at < now();
  get diagnostics exports_expired = row_count;
  return jsonb_build_object(
    'notification_outbox_deleted', outbox_deleted,
    'notification_events_deleted', events_deleted,
    'deletion_requests_deleted', requests_deleted,
    'exports_expired', exports_expired,
    'completed_at', now()
  );
end;
$$;

revoke all on function public.run_gdpr_retention() from public, anon, authenticated;
grant execute on function public.run_gdpr_retention() to service_role;
insert into kinavela_private.schema_migrations(version) values ('202608110015_gdpr_retention_metrics') on conflict (version) do nothing;
notify pgrst, 'reload schema';
commit;
