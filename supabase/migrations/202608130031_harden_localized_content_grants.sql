begin;

revoke all on public.cultural_mission_translations,
  public.mission_step_translations,
  public.country_translations,
  public.culture_translations,
  public.language_translations
  from public, anon, service_role;

grant select on public.cultural_mission_translations,
  public.mission_step_translations,
  public.country_translations,
  public.culture_translations,
  public.language_translations
  to authenticated;

insert into kinavela_private.schema_migrations(version)
values ('202608130031_harden_localized_content_grants')
on conflict (version) do nothing;

notify pgrst, 'reload schema';

commit;
