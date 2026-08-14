begin;

create or replace function public.list_connection_child_summaries()
returns table (
  connection_id uuid,
  child_nickname text,
  age_range text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  profile_uuid uuid := public.current_profile_id();
  family_uuid uuid := kinavela_private.current_family_id(false);
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  if family_uuid is null then raise exception 'family_not_found'; end if;

  return query
  select
    connection.id,
    child.nickname,
    case
      when extract(year from age(
        current_date,
        make_date(child.birth_year, coalesce(child.birth_month, 7), 1)
      )) < 3 then '0-2'
      when extract(year from age(
        current_date,
        make_date(child.birth_year, coalesce(child.birth_month, 7), 1)
      )) < 6 then '3-5'
      when extract(year from age(
        current_date,
        make_date(child.birth_year, coalesce(child.birth_month, 7), 1)
      )) < 9 then '6-8'
      when extract(year from age(
        current_date,
        make_date(child.birth_year, coalesce(child.birth_month, 7), 1)
      )) < 13 then '9-12'
      when extract(year from age(
        current_date,
        make_date(child.birth_year, coalesce(child.birth_month, 7), 1)
      )) < 16 then '13-15'
      when extract(year from age(
        current_date,
        make_date(child.birth_year, coalesce(child.birth_month, 7), 1)
      )) < 18 then '16-17'
      else '18+'
    end
  from public.family_connections connection
  join public.children child
    on child.family_id = case
      when connection.requester_family_id = family_uuid then connection.recipient_family_id
      else connection.requester_family_id
    end
  where family_uuid in (
      connection.requester_family_id,
      connection.recipient_family_id
    )
    and connection.status = 'accepted'
    and child.visibility = 'connections'
    and kinavela_private.families_are_connected(
      connection.requester_family_id,
      connection.recipient_family_id
    )
  order by connection.id, child.birth_year desc, child.birth_month desc nulls last;
end;
$$;

revoke all on function public.list_connection_child_summaries()
from public, anon, authenticated, service_role;
grant execute on function public.list_connection_child_summaries()
to authenticated;

insert into kinavela_private.schema_migrations(version)
values ('202608130003_child_connection_visibility')
on conflict (version) do nothing;

notify pgrst, 'reload schema';
commit;
