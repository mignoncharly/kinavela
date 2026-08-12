begin;

create or replace function kinavela_private.pilot_city_key(p_city text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  with normalized as (
    select regexp_replace(
      translate(lower(btrim(p_city)), 'äöüß', 'aous'),
      '[^a-z0-9]+',
      '',
      'g'
    ) as city_key
  )
  select case city_key
    when 'munchen' then 'munich'
    else city_key
  end
  from normalized;
$$;

revoke all on function kinavela_private.pilot_city_key(text) from public, anon, authenticated, service_role;

insert into kinavela_private.schema_migrations(version)
values ('202608110021_phase_a_city_aliases')
on conflict (version) do nothing;
notify pgrst, 'reload schema';
commit;
