begin;

drop policy if exists "Members read children" on public.children;
create policy "Guardians read children" on public.children for select to authenticated using (exists (select 1 from public.family_members member where member.family_id = children.family_id and member.profile_id = public.current_profile_id() and member.status = 'active' and member.role in ('owner', 'guardian')));

insert into kinavela_private.schema_migrations(version) values ('202608110025_child_privacy_rls') on conflict (version) do nothing;
notify pgrst, 'reload schema';
commit;
