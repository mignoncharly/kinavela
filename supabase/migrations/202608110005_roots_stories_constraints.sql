begin;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.roots_passport_entries'::regclass
      and conname = 'roots_passport_entries_story_id_fkey'
  ) then
    alter table public.roots_passport_entries
      add constraint roots_passport_entries_story_id_fkey
      foreign key (story_id) references public.family_stories(id) on delete set null;
  end if;
end
$$;

insert into kinavela_private.schema_migrations(version)
values ('202608110005_roots_stories_constraints')
on conflict (version) do nothing;

notify pgrst, 'reload schema';
commit;
