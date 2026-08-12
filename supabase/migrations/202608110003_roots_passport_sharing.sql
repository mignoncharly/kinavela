begin;

create or replace function kinavela_private.can_view_roots_entry(p_entry_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.roots_passport_entries entry
    join public.roots_passports passport on passport.id = entry.passport_id
    join public.children child on child.id = passport.child_id
    where entry.id = p_entry_id
      and (
        exists (
          select 1 from public.family_members member
          where member.family_id = child.family_id
            and member.profile_id = public.current_profile_id()
            and member.status = 'active'
            and member.role in ('owner', 'guardian')
        )
        or (
          entry.visibility = 'family'
          and exists (
            select 1 from public.family_members member
            where member.family_id = child.family_id
              and member.profile_id = public.current_profile_id()
              and member.status = 'active'
          )
        )
        or (
          entry.visibility = 'village'
          and entry.village_id is not null
          and public.can_access_village(entry.village_id)
        )
      )
  );
$$;

create or replace function public.list_roots_passport_entries(p_child_id uuid)
returns table (
  entry_id uuid,
  passport_id uuid,
  child_id uuid,
  type text,
  title text,
  description text,
  culture_name text,
  language_name text,
  event_id uuid,
  mission_id uuid,
  village_id uuid,
  occurred_at timestamptz,
  visibility text,
  media_kind text,
  media_available boolean,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  passport_uuid uuid;
begin
  if public.current_profile_id() is null then raise exception 'not_authenticated'; end if;
  select passport.id into passport_uuid
  from public.roots_passports passport
  where passport.child_id = p_child_id;
  if passport_uuid is null then raise exception 'passport_not_found'; end if;
  if not kinavela_private.can_manage_roots_passport(passport_uuid)
     and not exists (
       select 1 from public.roots_passport_entries shared_entry
       where shared_entry.passport_id = passport_uuid
         and kinavela_private.can_view_roots_entry(shared_entry.id)
     ) then
    raise exception 'not_authorized';
  end if;
  return query
  select entry.id, entry.passport_id, p_child_id, entry.type, entry.title, entry.description,
    culture.name, language.name, entry.event_id, entry.mission_id, entry.village_id,
    entry.occurred_at, entry.visibility, entry.media_kind, entry.media_path is not null,
    entry.created_at
  from public.roots_passport_entries entry
  left join public.cultures culture on culture.id = entry.culture_id
  left join public.languages language on language.id = entry.language_id
  where entry.passport_id = passport_uuid
    and (kinavela_private.can_manage_roots_passport(passport_uuid)
      or kinavela_private.can_view_roots_entry(entry.id))
  order by entry.occurred_at desc, entry.created_at desc, entry.id;
end;
$$;

revoke all on function public.list_roots_passport_entries(uuid)
  from public, anon, service_role;
grant execute on function public.list_roots_passport_entries(uuid) to authenticated;

insert into kinavela_private.schema_migrations(version)
values ('202608110003_roots_passport_sharing')
on conflict (version) do nothing;

notify pgrst, 'reload schema';
commit;
