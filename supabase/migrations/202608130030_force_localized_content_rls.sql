begin;

alter table public.cultural_mission_translations force row level security;
alter table public.mission_step_translations force row level security;
alter table public.country_translations force row level security;
alter table public.culture_translations force row level security;
alter table public.language_translations force row level security;

insert into kinavela_private.schema_migrations(version)
values ('202608130030_force_localized_content_rls')
on conflict (version) do nothing;

notify pgrst, 'reload schema';

commit;
