begin;

create or replace function kinavela_private.can_view_event_address(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.events e
    where e.id = p_event_id
      and kinavela_private.can_access_village(e.village_id, false)
      and (
        kinavela_private.can_manage_village_events(e.village_id)
        or (
          e.status = 'scheduled'
          and (
            e.address_visibility = 'all_members'
            or exists (
              select 1 from public.event_attendees ea
              where ea.event_id = e.id
                and ea.family_id = kinavela_private.current_family_id(false)
                and ea.status = 'going'
            )
          )
        )
      )
  )
$$;

revoke all on function kinavela_private.can_view_event_address(uuid)
  from public, anon, authenticated, service_role;

create or replace function kinavela_private.rebalance_event_capacity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  waiting_family_id uuid;
begin
  if new.status <> 'scheduled' or new.max_families is not distinct from old.max_families then
    return new;
  end if;

  if new.max_families is null then
    for waiting_family_id in
      select family_id from public.event_attendees
      where event_id = new.id and status = 'waitlisted'
      order by created_at, family_id
      for update
    loop
      update public.event_attendees set status = 'going', updated_at = now()
      where event_id = new.id and family_id = waiting_family_id;
      perform kinavela_private.queue_event_delivery(
        new.id, waiting_family_id, 'waitlist_promoted', now()
      );
      perform kinavela_private.queue_event_delivery(
        new.id, waiting_family_id, 'scheduled_24h',
        greatest(now(), new.starts_at - interval '24 hours')
      );
    end loop;
    return new;
  end if;

  while (select count(*) from public.event_attendees
         where event_id = new.id and status = 'going') < new.max_families
  loop
    waiting_family_id := kinavela_private.promote_event_waitlist(new.id);
    exit when waiting_family_id is null;
  end loop;
  return new;
end;
$$;

revoke all on function kinavela_private.rebalance_event_capacity()
  from public, anon, authenticated, service_role;

create trigger event_capacity_rebalance
  after update of max_families on public.events
  for each row execute function kinavela_private.rebalance_event_capacity();

create or replace function public.cancel_village_event(p_event_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_uuid uuid := public.current_profile_id();
  event_row public.events%rowtype;
  attendee record;
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  select * into event_row from public.events where id = p_event_id for update;
  if event_row.id is null or event_row.status <> 'scheduled' or event_row.ends_at <= now() then
    raise exception 'event_not_available';
  end if;
  if not kinavela_private.can_manage_village_events(event_row.village_id) then
    raise exception 'not_authorized';
  end if;
  update public.events set status = 'cancelled', cancelled_at = now() where id = p_event_id;
  delete from public.event_reminder_deliveries
  where event_id = p_event_id and reminder_kind = 'scheduled_24h';
  for attendee in
    select family_id from public.event_attendees
    where event_id = p_event_id and status in ('going', 'maybe', 'waitlisted')
  loop
    perform kinavela_private.queue_event_delivery(
      p_event_id, attendee.family_id, 'event_cancelled', now()
    );
  end loop;
  insert into public.audit_events(actor_profile_id, event_type, entity_type, entity_id)
  values (profile_uuid, 'event_cancelled', 'event', p_event_id);
  return true;
end;
$$;

revoke all on function public.cancel_village_event(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.cancel_village_event(uuid) to authenticated;

insert into kinavela_private.schema_migrations(version)
values ('202608100002_event_capacity_and_cancel_guards');

commit;
