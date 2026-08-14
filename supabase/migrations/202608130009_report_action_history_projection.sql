begin;

create or replace function public.admin_list_report_action_history(
  p_report_id uuid
)
returns table (
  action_id uuid,
  action_type text,
  previous_status text,
  new_status text,
  severity text,
  note text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not kinavela_private.is_admin(public.current_profile_id()) then
    raise exception 'admin_required';
  end if;
  if not exists (select 1 from public.reports where id = p_report_id) then
    raise exception 'report_not_found';
  end if;
  return query
  select history.id, history.action_type, history.previous_status,
    history.new_status, history.severity, history.note, history.created_at
  from public.report_action_history history
  where history.report_id = p_report_id
  order by history.created_at, history.id;
end;
$$;

revoke all on function public.admin_list_report_action_history(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_list_report_action_history(uuid)
  to authenticated;

insert into kinavela_private.schema_migrations(version)
values ('202608130009_report_action_history_projection');

notify pgrst, 'reload schema';
commit;
