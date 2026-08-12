begin;

create or replace function public.claim_notification_deliveries()
returns table (
  delivery_id uuid,
  recipient_profile_id uuid,
  channel text,
  notification_kind text,
  recipient_email text,
  locale text,
  channel_enabled boolean,
  payload jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  update public.notification_outbox
  set
    status = case when attempts >= 5 then 'failed' else 'queued' end,
    error_code = case
      when attempts >= 5 then 'delivery_retries_exhausted'
      else error_code
    end
  where status = 'processing'
    and created_at < now() - interval '15 minutes';

  return query
  with picked as (
    select outbox.id
    from public.notification_outbox outbox
    where outbox.status = 'queued'
      and outbox.scheduled_at <= now()
      and outbox.attempts < 5
    order by outbox.scheduled_at, outbox.created_at
    for update skip locked
    limit 50
  ),
  claimed as (
    update public.notification_outbox outbox
    set status = 'processing', attempts = attempts + 1
    where outbox.id in (select id from picked)
    returning outbox.*
  )
  select
    claimed.id,
    claimed.recipient_profile_id,
    claimed.channel,
    claimed.notification_kind,
    auth_user.email,
    profile.preferred_language::text,
    case claimed.channel
      when 'email' then kinavela_private.feature_enabled(
        'notifications_email',
        claimed.recipient_profile_id
      )
      when 'push' then kinavela_private.feature_enabled(
        'web_push_delivery',
        claimed.recipient_profile_id
      )
      else true
    end,
    claimed.payload
  from claimed
  join public.profiles profile on profile.id = claimed.recipient_profile_id
  join auth.users auth_user on auth_user.id = profile.auth_user_id;
end;
$$;

revoke all on function public.claim_notification_deliveries()
  from public, anon, authenticated, service_role;
grant execute on function public.claim_notification_deliveries()
  to service_role;

comment on function public.claim_notification_deliveries() is
  'Service-role-only outbox claim with private recipient identity and per-profile delivery rollout state.';

insert into kinavela_private.schema_migrations(version)
values ('202608120003_notification_claim_locale_type')
on conflict (version) do nothing;

notify pgrst, 'reload schema';

commit;
