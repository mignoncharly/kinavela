begin;

alter table public.subscriptions
  add column if not exists plan text check (plan in ('monthly', 'annual')),
  add column if not exists canceled_at timestamptz;

drop index if exists public.subscriptions_one_current_family_idx;
create unique index subscriptions_one_current_family_idx
  on public.subscriptions(family_id)
  where status in ('trialing', 'active', 'past_due');

alter table public.subscription_events
  add column if not exists processing_status text not null default 'processed'
    check (processing_status in ('processing', 'processed', 'failed')),
  add column if not exists processing_error text
    check (processing_error is null or char_length(processing_error) <= 240);

update public.subscription_events
set processing_status = 'processed'
where processing_status is distinct from 'processed';

drop function if exists public.sync_billing_subscription(uuid,text,text,text,text,text,timestamptz,timestamptz,boolean,timestamptz);

create or replace function public.sync_billing_subscription(
  p_family_id uuid,
  p_stripe_customer_id text,
  p_stripe_subscription_id text,
  p_product_key text,
  p_price_id text,
  p_plan text,
  p_status text,
  p_current_period_start timestamptz default null,
  p_current_period_end timestamptz default null,
  p_cancel_at_period_end boolean default false,
  p_canceled_at timestamptz default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role_required';
  end if;
  if p_status not in (
    'incomplete', 'incomplete_expired', 'trialing', 'active',
    'past_due', 'canceled', 'unpaid', 'paused'
  ) then
    raise exception 'invalid_subscription_status';
  end if;
  if p_plan not in ('monthly', 'annual') then
    raise exception 'invalid_billing_plan';
  end if;
  if not exists (select 1 from public.families where id = p_family_id) then
    raise exception 'family_not_found';
  end if;

  if p_status in ('trialing', 'active', 'past_due') then
    update public.subscriptions
    set status = 'canceled',
        canceled_at = coalesce(canceled_at, now()),
        cancel_at_period_end = false,
        updated_at = now()
    where family_id = p_family_id
      and status in ('trialing', 'active', 'past_due')
      and stripe_subscription_id <> p_stripe_subscription_id;
  end if;

  insert into public.billing_customers(family_id, stripe_customer_id)
  values (p_family_id, p_stripe_customer_id)
  on conflict (family_id) do update
    set stripe_customer_id = excluded.stripe_customer_id,
        updated_at = now();

  insert into public.subscriptions(
    family_id, stripe_customer_id, stripe_subscription_id, product_key,
    price_id, plan, status, current_period_start, current_period_end,
    cancel_at_period_end, canceled_at
  )
  values (
    p_family_id, p_stripe_customer_id, p_stripe_subscription_id,
    coalesce(p_product_key, 'roots_family'), p_price_id, p_plan, p_status,
    p_current_period_start, p_current_period_end,
    coalesce(p_cancel_at_period_end, false), p_canceled_at
  )
  on conflict (stripe_subscription_id) do update set
    family_id = excluded.family_id,
    stripe_customer_id = excluded.stripe_customer_id,
    product_key = excluded.product_key,
    price_id = excluded.price_id,
    plan = excluded.plan,
    status = excluded.status,
    current_period_start = excluded.current_period_start,
    current_period_end = excluded.current_period_end,
    cancel_at_period_end = excluded.cancel_at_period_end,
    canceled_at = excluded.canceled_at,
    updated_at = now();

  insert into public.audit_events(actor_profile_id, event_type, entity_type, metadata)
  values (
    null, 'subscription_synced', 'subscription',
    jsonb_build_object('family_id', p_family_id, 'status', p_status, 'plan', p_plan)
  );
  return true;
end;
$$;

create or replace function kinavela_private.family_has_entitlement(
  p_family_id uuid,
  p_entitlement text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.subscriptions subscription
    where subscription.family_id = p_family_id
      and subscription.status in ('trialing', 'active', 'past_due')
      and subscription.product_key = 'roots_family'
      and p_entitlement = 'roots_stories_ai'
  )
$$;

drop function if exists public.get_my_entitlements();

create or replace function public.get_my_entitlements()
returns table (
  plan text,
  status text,
  has_billing_customer boolean,
  roots_stories_ai boolean,
  current_period_end timestamptz,
  cancel_at_period_end boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with my_family as (
    select member.family_id
    from public.family_members member
    join public.profiles profile on profile.id = member.profile_id
    where profile.auth_user_id = auth.uid()
      and profile.status = 'active'
      and member.status = 'active'
      and member.role in ('owner', 'guardian')
    order by member.created_at
    limit 1
  ),
  current_subscription as (
    select subscription.*
    from public.subscriptions subscription
    join my_family family on family.family_id = subscription.family_id
    where subscription.status in ('trialing', 'active', 'past_due')
    order by subscription.updated_at desc
    limit 1
  )
  select
    coalesce(subscription.plan, 'free'),
    coalesce(subscription.status, 'free'),
    exists (
      select 1
      from public.billing_customers customer
      join my_family family on family.family_id = customer.family_id
    ),
    coalesce(subscription.product_key = 'roots_family', false),
    subscription.current_period_end,
    coalesce(subscription.cancel_at_period_end, false)
  from current_subscription subscription
  union all
  select
    'free', 'free',
    exists (
      select 1
      from public.billing_customers customer
      join my_family family on family.family_id = customer.family_id
    ),
    false, null::timestamptz, false
  where not exists (select 1 from current_subscription)
  limit 1
$$;

create or replace function public.record_subscription_event(
  p_stripe_event_id text,
  p_event_type text,
  p_payload jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role_required';
  end if;
  insert into public.subscription_events(
    stripe_event_id, event_type, payload, processing_status, processing_error
  )
  values (
    p_stripe_event_id, p_event_type,
    case when jsonb_typeof(p_payload) = 'object' then p_payload else '{}'::jsonb end,
    'processing', null
  )
  on conflict (stripe_event_id) do update set
    processing_status = 'processing',
    processing_error = null,
    processed_at = now()
  where subscription_events.processing_status <> 'processed';
  return found;
end;
$$;

create or replace function public.complete_subscription_event(p_stripe_event_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role_required';
  end if;
  update public.subscription_events
  set processing_status = 'processed', processing_error = null, processed_at = now()
  where stripe_event_id = p_stripe_event_id;
  return found;
end;
$$;

create or replace function public.fail_subscription_event(
  p_stripe_event_id text,
  p_error text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role_required';
  end if;
  update public.subscription_events
  set processing_status = 'failed',
      processing_error = left(coalesce(p_error, 'webhook_processing_failed'), 240),
      processed_at = now()
  where stripe_event_id = p_stripe_event_id;
  return found;
end;
$$;

revoke all on function public.get_my_entitlements(),
  public.sync_billing_subscription(uuid,text,text,text,text,text,text,timestamptz,timestamptz,boolean,timestamptz),
  public.record_subscription_event(text,text,jsonb),
  public.complete_subscription_event(text),
  public.fail_subscription_event(text,text)
from public, anon, authenticated, service_role;

grant execute on function public.get_my_entitlements() to authenticated;
grant execute on function public.sync_billing_subscription(
  uuid,text,text,text,text,text,text,timestamptz,timestamptz,boolean,timestamptz
), public.record_subscription_event(text,text,jsonb),
public.complete_subscription_event(text), public.fail_subscription_event(text,text)
to service_role;

insert into kinavela_private.retention_policies(
  policy_key, resource, retention_days, action, notes
)
values (
  'subscription_events', 'subscription_events.created_at', 2555, 'review',
  'Keep minimized billing event metadata for finance and webhook audit; review with the controller before deletion.'
)
on conflict (policy_key) do update set
  resource = excluded.resource,
  retention_days = excluded.retention_days,
  action = excluded.action,
  notes = excluded.notes,
  updated_at = now();

insert into kinavela_private.schema_migrations(version)
values ('202608120001_billing_hardening')
on conflict (version) do nothing;

notify pgrst, 'reload schema';
commit;

