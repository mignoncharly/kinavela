begin;

create or replace function kinavela_private.calculate_family_match(
  p_requester_family_id uuid,
  p_candidate_family_id uuid,
  p_distance_km double precision,
  p_radius_km integer
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select kinavela_private.calculate_family_match(
    p_requester_family_id,
    p_candidate_family_id,
    p_distance_km::numeric,
    p_radius_km
  );
$$;

revoke all on function kinavela_private.calculate_family_match(uuid, uuid, double precision, integer)
  from public, anon, authenticated, service_role;

insert into kinavela_private.schema_migrations(version)
values ('202608090007_matching_distance_type')
on conflict (version) do nothing;

notify pgrst, 'reload schema';
commit;
