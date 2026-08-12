begin;

alter table kinavela_private.public_seo_pages enable row level security;
alter table kinavela_private.public_seo_pages force row level security;
revoke all on kinavela_private.public_seo_pages from public, anon, authenticated, service_role;

insert into kinavela_private.schema_migrations(version)
values ('202608110013_public_seo_hardening')
on conflict (version) do nothing;

notify pgrst, 'reload schema';
commit;
