begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists postgis with schema extensions;

create schema if not exists kinavela_private;
revoke all on schema kinavela_private from public, anon, authenticated;

create table if not exists kinavela_private.schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);

create table if not exists public.system_status (
  id smallint primary key check (id = 1),
  service_name text not null check (service_name = 'kinavela'),
  created_at timestamptz not null default now()
);

alter table public.system_status enable row level security;
alter table public.system_status force row level security;

revoke all on table public.system_status from public, anon, authenticated;
grant select on table public.system_status to anon, authenticated;

drop policy if exists "Public may read non-sensitive service status" on public.system_status;
create policy "Public may read non-sensitive service status"
  on public.system_status
  for select
  to anon, authenticated
  using (id = 1);

insert into public.system_status (id, service_name)
values (1, 'kinavela')
on conflict (id) do update set service_name = excluded.service_name;

create or replace function public.healthcheck()
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.system_status
    where id = 1 and service_name = 'kinavela'
  );
$$;

revoke all on function public.healthcheck() from public;
grant execute on function public.healthcheck() to anon, authenticated;

comment on table public.system_status is
  'Non-sensitive Kinavela service marker. RLS is forced; no user data belongs here.';
comment on function public.healthcheck() is
  'Minimal readiness probe that exposes no database or user details.';

insert into kinavela_private.schema_migrations (version)
values ('202608090001_foundation')
on conflict (version) do nothing;

notify pgrst, 'reload schema';

commit;
