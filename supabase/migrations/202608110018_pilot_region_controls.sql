begin;

create or replace function public.admin_set_pilot_region_status(p_country_code text, p_city text, p_status text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare actor_uuid uuid := public.current_profile_id();
begin
  if not kinavela_private.is_admin(actor_uuid) then raise exception 'admin_required'; end if;
  if upper(p_country_code) <> 'DE' or char_length(btrim(coalesce(p_city, ''))) not between 2 and 120 or p_status not in ('waitlist','open','paused') then raise exception 'invalid_pilot_region'; end if;
  update kinavela_private.pilot_regions set status = p_status, updated_at = now() where country_code = 'DE' and lower(city) = lower(btrim(p_city));
  if not found then raise exception 'pilot_region_not_found'; end if;
  insert into public.audit_events(actor_profile_id, event_type, entity_type, metadata) values (actor_uuid, 'pilot_region_status_changed', 'pilot_region', jsonb_build_object('country_code','DE','city',btrim(p_city),'status',p_status));
  return true;
end;
$$;

revoke all on function public.admin_set_pilot_region_status(text,text,text) from public, anon, authenticated, service_role;
grant execute on function public.admin_set_pilot_region_status(text,text,text) to authenticated;
insert into kinavela_private.schema_migrations(version) values ('202608110018_pilot_region_controls') on conflict (version) do nothing;
notify pgrst, 'reload schema';
commit;
