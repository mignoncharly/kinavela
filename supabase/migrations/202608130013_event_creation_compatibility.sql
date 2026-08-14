begin;

create or replace function public.create_village_event(
  p_village_id uuid, p_title text, p_description text, p_category text,
  p_starts_at timestamptz, p_ends_at timestamptz, p_location_name text,
  p_location_city text, p_location_address text, p_public_location_description text,
  p_address_visibility text, p_max_families integer, p_registration_deadline timestamptz
) returns uuid language sql security invoker set search_path = '' as $$
  select public.create_village_event(
    p_village_id,p_title,p_description,p_category,p_starts_at,p_ends_at,
    p_location_name,p_location_city,p_location_address,p_public_location_description,
    p_address_visibility,p_max_families,p_registration_deadline,null,null
  )
$$;

revoke all on function public.create_village_event(uuid,text,text,text,timestamptz,timestamptz,text,text,text,text,text,integer,timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.create_village_event(uuid,text,text,text,timestamptz,timestamptz,text,text,text,text,text,integer,timestamptz)
  to authenticated;

insert into kinavela_private.schema_migrations(version)
values ('202608130013_event_creation_compatibility');
notify pgrst, 'reload schema';
commit;
