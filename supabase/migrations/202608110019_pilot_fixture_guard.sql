begin;

create or replace function kinavela_private.enforce_pilot_family_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare settings kinavela_private.pilot_settings%rowtype; active_families integer;
begin
  if auth.uid() is null or not exists (select 1 from public.profiles where id = new.created_by and auth_user_id = auth.uid()) then
    return new;
  end if;
  select * into settings from kinavela_private.pilot_settings where id = true;
  if coalesce(settings.enabled, false) then
    if not (upper(new.country_of_residence) = any(settings.allowed_country_codes)) then raise exception 'pilot_country_closed'; end if;
    perform pg_advisory_xact_lock(hashtextextended('kinavela-pilot-family-cap', 0));
    select count(*)::integer into active_families from public.families family join public.profiles profile on profile.id = family.created_by where profile.status = 'active' and family.country_of_residence = any(settings.allowed_country_codes);
    if active_families >= settings.max_active_families then raise exception 'pilot_capacity_reached'; end if;
  end if;
  return new;
end;
$$;

insert into kinavela_private.schema_migrations(version) values ('202608110019_pilot_fixture_guard') on conflict (version) do nothing;
notify pgrst, 'reload schema';
commit;
