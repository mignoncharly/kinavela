begin;

alter function public.get_personal_data_export_payload(uuid)
  rename to get_personal_data_export_payload_phase7;

create function public.get_personal_data_export_payload(p_profile_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare payload jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role_required';
  end if;
  payload := public.get_personal_data_export_payload_phase7(p_profile_id);
  return payload || jsonb_build_object(
    'private_playdates', coalesce((
      select jsonb_agg(
        (to_jsonb(playdate) - 'proposer_profile_id') || jsonb_build_object(
          'exact_address', location.exact_address,
          'time_options', coalesce((
            select jsonb_agg(to_jsonb(option) order by option.starts_at)
            from public.playdate_time_options option
            where option.playdate_id = playdate.id
          ), '[]'::jsonb)
        ) order by playdate.created_at
      )
      from public.playdates playdate
      join kinavela_private.playdate_locations location
        on location.playdate_id = playdate.id
      where exists (
        select 1 from public.family_members member
        where member.profile_id = p_profile_id
          and member.family_id in (
            playdate.proposer_family_id, playdate.recipient_family_id
          )
      )
    ), '[]'::jsonb),
    'event_coordination_messages', coalesce((
      select jsonb_agg(to_jsonb(message) order by message.created_at)
      from public.event_messages message
      where message.sender_profile_id = p_profile_id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function kinavela_private.erase_profile_offline_coordination()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.status is distinct from new.status and new.status = 'deleted' then
    update public.event_messages set
      body = '[removed after account deletion]',
      deleted_at = coalesce(deleted_at, now())
    where sender_profile_id = new.id;

    update public.playdates set
      status = 'cancelled', selected_option_id = null,
      responded_at = null, cancelled_at = coalesce(cancelled_at, now()),
      updated_at = now()
    where proposer_profile_id = new.id;

    update kinavela_private.playdate_locations location set
      exact_address = 'Address removed after account deletion'
    from public.playdates playdate
    where playdate.id = location.playdate_id
      and playdate.proposer_profile_id = new.id;

    delete from public.playdate_reminder_deliveries reminder
    using public.playdates playdate
    where playdate.id = reminder.playdate_id
      and playdate.proposer_profile_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_erase_offline_coordination on public.profiles;
create trigger profiles_erase_offline_coordination
  before update of status on public.profiles
  for each row execute function kinavela_private.erase_profile_offline_coordination();

revoke all on function public.get_personal_data_export_payload_phase7(uuid),
  public.get_personal_data_export_payload(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_personal_data_export_payload(uuid)
  to service_role;
revoke all on function kinavela_private.erase_profile_offline_coordination()
  from public, anon, authenticated, service_role;

insert into kinavela_private.schema_migrations(version)
values ('202608130015_offline_coordination_privacy_lifecycle');
notify pgrst, 'reload schema';
commit;
