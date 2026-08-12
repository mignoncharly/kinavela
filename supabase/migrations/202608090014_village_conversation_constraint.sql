begin;

alter table public.conversations
  drop constraint if exists conversations_conversation_type_check1;

insert into kinavela_private.schema_migrations(version)
values ('202608090014_village_conversation_constraint')
on conflict(version) do nothing;

notify pgrst, 'reload schema';
commit;
