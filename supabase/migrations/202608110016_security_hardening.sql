begin;

do $$
declare
  relation record;
begin
  for relation in
    select n.nspname as schema_name, c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  loop
    execute format('alter table %I.%I enable row level security', relation.schema_name, relation.table_name);
    execute format('alter table %I.%I force row level security', relation.schema_name, relation.table_name);
  end loop;
end
$$;

update storage.buckets
set public = false
where id in ('roots-media', 'story-audio', 'privacy-exports');

insert into kinavela_private.schema_migrations(version)
values ('202608110016_security_hardening')
on conflict (version) do nothing;
notify pgrst, 'reload schema';
commit;
