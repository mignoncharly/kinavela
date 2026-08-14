begin;

drop function public.create_village_event(
  uuid,text,text,text,timestamptz,timestamptz,text,text,text,text,text,integer,
  timestamptz,text,date
);

create function public.create_village_event(
  p_village_id uuid, p_title text, p_description text, p_category text,
  p_starts_at timestamptz, p_ends_at timestamptz, p_location_name text,
  p_location_city text, p_location_address text,
  p_public_location_description text, p_address_visibility text,
  p_max_families integer, p_registration_deadline timestamptz,
  p_recurrence_frequency text, p_recurrence_ends_on date
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  profile_uuid uuid := public.current_profile_id();
  family_uuid uuid := kinavela_private.current_family_id(false);
  first_event_uuid uuid := gen_random_uuid(); event_uuid uuid; series_uuid uuid;
  current_start timestamptz := p_starts_at; current_end timestamptz := p_ends_at;
  current_deadline timestamptz := coalesce(p_registration_deadline, p_starts_at);
  occurrence integer := 0;
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  if family_uuid is null or not kinavela_private.can_manage_village_events(p_village_id) then raise exception 'not_authorized'; end if;
  if p_starts_at <= now() or p_ends_at <= p_starts_at or current_deadline > p_starts_at
    or p_category not in ('playdate','park','picnic','cooking','language','cultural','sports','creative','family_support','celebration','other')
    or p_address_visibility not in ('going','all_members')
    or p_max_families is not null and p_max_families not between 1 and 100
    or p_recurrence_frequency is not null and p_recurrence_frequency not in ('weekly','biweekly','monthly')
    or (p_recurrence_frequency is null) <> (p_recurrence_ends_on is null)
    or p_recurrence_ends_on is not null and (p_recurrence_ends_on < p_starts_at::date
      or p_recurrence_ends_on > (p_starts_at + interval '1 year')::date) then raise exception 'invalid_event'; end if;
  if (select count(*) from public.events where creator_family_id = family_uuid
    and created_at >= now() - interval '24 hours') >= 52 then raise exception 'event_create_rate_limited'; end if;
  series_uuid := case when p_recurrence_frequency is null then null else gen_random_uuid() end;
  loop
    exit when occurrence >= 52 or (p_recurrence_ends_on is not null and current_start::date > p_recurrence_ends_on);
    event_uuid := case when occurrence = 0 then first_event_uuid else gen_random_uuid() end;
    insert into public.events(id,village_id,creator_family_id,creator_profile_id,title,description,
      category,starts_at,ends_at,location_name,location_city,public_location_description,
      address_visibility,max_families,registration_deadline,recurrence_frequency,
      recurrence_ends_on,recurrence_series_id,recurrence_index)
    values(event_uuid,p_village_id,family_uuid,profile_uuid,btrim(p_title),btrim(p_description),
      p_category,current_start,current_end,btrim(p_location_name),btrim(p_location_city),
      btrim(p_public_location_description),p_address_visibility,p_max_families,current_deadline,
      p_recurrence_frequency,p_recurrence_ends_on,series_uuid,occurrence);
    insert into kinavela_private.event_locations(event_id,location_address)
      values(event_uuid,btrim(p_location_address));
    occurrence := occurrence + 1;
    exit when p_recurrence_frequency is null;
    if p_recurrence_frequency = 'weekly' then
      current_start := current_start + interval '1 week'; current_end := current_end + interval '1 week'; current_deadline := current_deadline + interval '1 week';
    elsif p_recurrence_frequency = 'biweekly' then
      current_start := current_start + interval '2 weeks'; current_end := current_end + interval '2 weeks'; current_deadline := current_deadline + interval '2 weeks';
    else
      current_start := current_start + interval '1 month'; current_end := current_end + interval '1 month'; current_deadline := current_deadline + interval '1 month';
    end if;
  end loop;
  insert into public.audit_events(actor_profile_id,event_type,entity_type,entity_id,metadata)
    values(profile_uuid,'event_created','event',first_event_uuid,
      jsonb_build_object('recurrence',p_recurrence_frequency,'occurrences',occurrence));
  return first_event_uuid;
end;
$$;

revoke all on function public.create_village_event(
  uuid,text,text,text,timestamptz,timestamptz,text,text,text,text,text,integer,
  timestamptz,text,date
) from public, anon, authenticated, service_role;
grant execute on function public.create_village_event(
  uuid,text,text,text,timestamptz,timestamptz,text,text,text,text,text,integer,
  timestamptz,text,date
) to authenticated;

insert into kinavela_private.schema_migrations(version)
values ('202608130014_event_creation_overload_fix');
notify pgrst, 'reload schema';
commit;
