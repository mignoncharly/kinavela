begin;

create table public.village_support_posts (
  id uuid primary key default gen_random_uuid(),
  village_id uuid not null references public.villages(id) on delete cascade,
  author_profile_id uuid not null references public.profiles(id) on delete restrict,
  author_family_id uuid not null references public.families(id) on delete restrict,
  content_type text not null check (content_type in (
    'question', 'help_request', 'recommendation_request', 'resource',
    'announcement', 'offer_of_help'
  )),
  category text not null check (category in (
    'kita', 'school', 'german_language', 'administration',
    'immigration_integration', 'healthcare_navigation',
    'local_family_services', 'transport', 'childcare_coordination',
    'local_recommendations', 'other_practical_support'
  )),
  title text not null check (char_length(btrim(title)) between 5 and 120),
  body text not null check (char_length(btrim(body)) between 10 and 2000),
  status text not null default 'open' check (status in ('open', 'resolved', 'removed')),
  privacy_confirmed_at timestamptz not null,
  resolved_at timestamptz,
  removed_at timestamptz,
  removed_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_document tsvector generated always as (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(body, ''))
  ) stored,
  check (
    (status = 'open' and resolved_at is null and removed_at is null)
    or (status = 'resolved' and resolved_at is not null and removed_at is null)
    or (status = 'removed' and removed_at is not null)
  )
);

create table public.village_support_replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.village_support_posts(id) on delete cascade,
  author_profile_id uuid not null references public.profiles(id) on delete restrict,
  author_family_id uuid not null references public.families(id) on delete restrict,
  body text not null check (char_length(btrim(body)) between 2 and 1500),
  privacy_confirmed_at timestamptz not null,
  removed_at timestamptz,
  removed_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_document tsvector generated always as (
    to_tsvector('simple', coalesce(body, ''))
  ) stored
);

create index village_support_posts_village_time_idx
  on public.village_support_posts(village_id, created_at desc, id desc)
  where status <> 'removed';
create index village_support_posts_filters_idx
  on public.village_support_posts(village_id, status, category, content_type, created_at desc);
create index village_support_posts_search_idx
  on public.village_support_posts using gin(search_document);
create index village_support_replies_post_time_idx
  on public.village_support_replies(post_id, created_at, id)
  where removed_at is null;
create index village_support_replies_search_idx
  on public.village_support_replies using gin(search_document);

create trigger village_support_posts_set_updated_at
  before update on public.village_support_posts
  for each row execute function public.set_updated_at();
create trigger village_support_replies_set_updated_at
  before update on public.village_support_replies
  for each row execute function public.set_updated_at();

alter table public.village_support_posts enable row level security;
alter table public.village_support_posts force row level security;
alter table public.village_support_replies enable row level security;
alter table public.village_support_replies force row level security;

create policy "Village members read support posts"
  on public.village_support_posts for select to authenticated
  using (status <> 'removed' and public.can_access_village(village_id));
create policy "Village members read support replies"
  on public.village_support_replies for select to authenticated
  using (
    removed_at is null and exists (
      select 1 from public.village_support_posts post
      where post.id = post_id and post.status <> 'removed'
        and public.can_access_village(post.village_id)
    )
  );

revoke all on public.village_support_posts, public.village_support_replies
  from public, anon, authenticated, service_role;

create or replace function kinavela_private.assert_support_content(p_value text)
returns void
language plpgsql
immutable
security definer
set search_path = ''
as $$
begin
  if p_value ~* '[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}'
    or p_value ~ '(\+|00)[0-9][0-9 ()/-]{6,}[0-9]'
    or p_value ~ '(^|[^0-9])0[1-9][0-9 ()/-]{6,}[0-9]([^0-9]|$)'
  then
    raise exception 'private_contact_details_not_allowed';
  end if;
end;
$$;

create or replace function public.create_village_support_post(
  p_village_id uuid,
  p_content_type text,
  p_category text,
  p_title text,
  p_body text,
  p_privacy_confirmed boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_uuid uuid := public.current_profile_id();
  family_uuid uuid := kinavela_private.current_family_id(false);
  post_uuid uuid;
  clean_title text := btrim(coalesce(p_title, ''));
  clean_body text := btrim(coalesce(p_body, ''));
  recent_posts integer;
  member record;
begin
  if not kinavela_private.can_access_village(p_village_id, false) then
    raise exception 'village_not_available';
  end if;
  if not coalesce(p_privacy_confirmed, false) then
    raise exception 'privacy_confirmation_required';
  end if;
  if p_content_type not in (
    'question', 'help_request', 'recommendation_request', 'resource',
    'announcement', 'offer_of_help'
  ) then raise exception 'invalid_support_content_type'; end if;
  if p_category not in (
    'kita', 'school', 'german_language', 'administration',
    'immigration_integration', 'healthcare_navigation',
    'local_family_services', 'transport', 'childcare_coordination',
    'local_recommendations', 'other_practical_support'
  ) then raise exception 'invalid_support_category'; end if;
  if char_length(clean_title) not between 5 and 120
    or char_length(clean_body) not between 10 and 2000
  then raise exception 'invalid_support_content'; end if;
  perform kinavela_private.assert_support_content(clean_title || ' ' || clean_body);
  perform pg_advisory_xact_lock(
    hashtextextended('support-post-rate:' || profile_uuid::text, 0)
  );
  select count(*) into recent_posts from public.village_support_posts
  where author_profile_id = profile_uuid
    and created_at >= clock_timestamp() - interval '24 hours';
  if recent_posts >= 10 then raise exception 'support_post_rate_limited'; end if;

  insert into public.village_support_posts(
    village_id, author_profile_id, author_family_id, content_type, category,
    title, body, privacy_confirmed_at
  ) values (
    p_village_id, profile_uuid, family_uuid, p_content_type, p_category,
    clean_title, clean_body, now()
  ) returning id into post_uuid;

  for member in
    select distinct family_member.profile_id
    from public.village_members membership
    join public.family_members family_member
      on family_member.family_id = membership.family_id
     and family_member.status = 'active'
    join public.profiles profile on profile.id = family_member.profile_id
    where membership.village_id = p_village_id
      and membership.status = 'active'
      and profile.status = 'active'
      and family_member.profile_id <> profile_uuid
  loop
    perform kinavela_private.enqueue_notification(
      member.profile_id, 'village_activity', 'village_support_post', post_uuid,
      jsonb_build_object(
        'village_id', p_village_id, 'post_id', post_uuid,
        'activity_kind', 'support_post'
      )
    );
  end loop;
  insert into public.audit_events(
    actor_profile_id, event_type, entity_type, entity_id, metadata
  ) values (
    profile_uuid, 'village_support_post_created', 'village_support_post',
    post_uuid, jsonb_build_object(
      'village_id', p_village_id, 'content_type', p_content_type,
      'category', p_category
    )
  );
  return post_uuid;
end;
$$;

create or replace function public.reply_to_village_support_post(
  p_post_id uuid,
  p_body text,
  p_privacy_confirmed boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_uuid uuid := public.current_profile_id();
  family_uuid uuid := kinavela_private.current_family_id(false);
  post_row public.village_support_posts%rowtype;
  reply_uuid uuid;
  clean_body text := btrim(coalesce(p_body, ''));
  recent_replies integer;
begin
  select * into post_row from public.village_support_posts
  where id = p_post_id and status = 'open' for update;
  if post_row.id is null
    or not kinavela_private.can_access_village(post_row.village_id, false)
  then raise exception 'support_post_not_available'; end if;
  if not coalesce(p_privacy_confirmed, false) then
    raise exception 'privacy_confirmation_required';
  end if;
  if char_length(clean_body) not between 2 and 1500 then
    raise exception 'invalid_support_reply';
  end if;
  perform kinavela_private.assert_support_content(clean_body);
  perform pg_advisory_xact_lock(
    hashtextextended('support-reply-rate:' || profile_uuid::text, 0)
  );
  select count(*) into recent_replies from public.village_support_replies
  where author_profile_id = profile_uuid
    and created_at >= clock_timestamp() - interval '24 hours';
  if recent_replies >= 50 then raise exception 'support_reply_rate_limited'; end if;

  insert into public.village_support_replies(
    post_id, author_profile_id, author_family_id, body, privacy_confirmed_at
  ) values (
    post_row.id, profile_uuid, family_uuid, clean_body, now()
  ) returning id into reply_uuid;

  if post_row.author_profile_id <> profile_uuid then
    perform kinavela_private.enqueue_notification(
      post_row.author_profile_id, 'village_activity', 'village_support_reply',
      reply_uuid, jsonb_build_object(
        'village_id', post_row.village_id, 'post_id', post_row.id,
        'activity_kind', 'support_reply'
      )
    );
  end if;
  insert into public.audit_events(
    actor_profile_id, event_type, entity_type, entity_id, metadata
  ) values (
    profile_uuid, 'village_support_reply_created', 'village_support_reply',
    reply_uuid, jsonb_build_object(
      'village_id', post_row.village_id, 'post_id', post_row.id
    )
  );
  return reply_uuid;
end;
$$;

create or replace function public.close_village_support_post(p_post_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare profile_uuid uuid := public.current_profile_id();
begin
  update public.village_support_posts set status = 'resolved', resolved_at = now()
  where id = p_post_id and author_profile_id = profile_uuid and status = 'open'
    and public.can_access_village(village_id);
  if not found then raise exception 'support_post_not_available'; end if;
  insert into public.audit_events(
    actor_profile_id, event_type, entity_type, entity_id
  ) values (
    profile_uuid, 'village_support_post_resolved', 'village_support_post', p_post_id
  );
  return true;
end;
$$;

create or replace function public.list_village_support_posts(
  p_village_id uuid,
  p_query text default null,
  p_category text default null,
  p_content_type text default null,
  p_status text default 'open',
  p_before timestamptz default null,
  p_limit integer default 30
)
returns table (
  post_id uuid,
  content_type text,
  category text,
  title text,
  body text,
  status text,
  author_family_name text,
  is_author boolean,
  can_moderate boolean,
  reply_count bigint,
  replies jsonb,
  resolved_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  profile_uuid uuid := public.current_profile_id();
  clean_query text := nullif(btrim(coalesce(p_query, '')), '');
begin
  if not kinavela_private.can_access_village(p_village_id, false) then
    raise exception 'village_not_available';
  end if;
  if p_limit not between 1 and 50 then raise exception 'invalid_limit'; end if;
  if clean_query is not null and char_length(clean_query) not between 2 and 80 then
    raise exception 'invalid_support_query';
  end if;
  if p_status not in ('open', 'resolved', 'all') then
    raise exception 'invalid_support_status';
  end if;
  if p_category is not null and p_category not in (
    'kita', 'school', 'german_language', 'administration',
    'immigration_integration', 'healthcare_navigation',
    'local_family_services', 'transport', 'childcare_coordination',
    'local_recommendations', 'other_practical_support'
  ) then raise exception 'invalid_support_category'; end if;
  if p_content_type is not null and p_content_type not in (
    'question', 'help_request', 'recommendation_request', 'resource',
    'announcement', 'offer_of_help'
  ) then raise exception 'invalid_support_content_type'; end if;

  return query
  select post.id, post.content_type, post.category, post.title, post.body,
    post.status, family.name, post.author_profile_id = profile_uuid,
    kinavela_private.can_access_village(post.village_id, true),
    (
      select count(*) from public.village_support_replies reply
      where reply.post_id = post.id and reply.removed_at is null
    ),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'reply_id', reply.id,
        'body', reply.body,
        'author_family_name', reply_family.name,
        'is_author', reply.author_profile_id = profile_uuid,
        'created_at', reply.created_at
      ) order by reply.created_at, reply.id)
      from public.village_support_replies reply
      join public.families reply_family on reply_family.id = reply.author_family_id
      where reply.post_id = post.id and reply.removed_at is null
    ), '[]'::jsonb),
    post.resolved_at, post.created_at
  from public.village_support_posts post
  join public.families family on family.id = post.author_family_id
  where post.village_id = p_village_id
    and post.status <> 'removed'
    and (p_status = 'all' or post.status = p_status)
    and (p_category is null or post.category = p_category)
    and (p_content_type is null or post.content_type = p_content_type)
    and (p_before is null or post.created_at < p_before)
    and (
      clean_query is null
      or post.search_document @@ websearch_to_tsquery('simple', clean_query)
      or exists (
        select 1 from public.village_support_replies reply
        where reply.post_id = post.id and reply.removed_at is null
          and reply.search_document @@ websearch_to_tsquery('simple', clean_query)
      )
    )
  order by post.created_at desc, post.id desc
  limit p_limit;
end;
$$;

alter table public.village_moderation_actions
  drop constraint village_moderation_actions_action_type_check;
alter table public.village_moderation_actions
  add constraint village_moderation_actions_action_type_check check (action_type in (
    'join_approved', 'join_declined', 'family_invited', 'invite_accepted',
    'invite_declined', 'role_changed', 'ownership_transferred',
    'member_left', 'member_removed', 'message_removed', 'report_dismissed',
    'support_post_removed', 'support_reply_removed'
  ));

create or replace function kinavela_private.remove_village_support_content(
  p_post_id uuid,
  p_reply_id uuid,
  p_actor_profile_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare village_uuid uuid;
begin
  if (p_post_id is null) = (p_reply_id is null) then
    raise exception 'invalid_support_target';
  end if;
  if p_reply_id is not null then
    update public.village_support_replies reply set
      removed_at = now(), removed_by_profile_id = p_actor_profile_id
    from public.village_support_posts post
    where reply.id = p_reply_id and reply.post_id = post.id
      and reply.removed_at is null and post.status <> 'removed'
    returning post.village_id into village_uuid;
  else
    update public.village_support_posts set
      status = 'removed', removed_at = now(), removed_by_profile_id = p_actor_profile_id
    where id = p_post_id and status <> 'removed'
    returning village_id into village_uuid;
  end if;
  if village_uuid is null then raise exception 'support_content_not_available'; end if;
  return village_uuid;
end;
$$;

create or replace function public.moderate_village_support_content(
  p_post_id uuid,
  p_reply_id uuid,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_uuid uuid := public.current_profile_id();
  family_uuid uuid := kinavela_private.current_family_id(false);
  village_uuid uuid;
begin
  if p_reason not in ('unsafe', 'privacy', 'outdated', 'duplicate', 'other') then
    raise exception 'invalid_support_moderation_reason';
  end if;
  select coalesce(post.village_id, reply_post.village_id)
  into village_uuid
  from (select 1) seed
  left join public.village_support_posts post on post.id = p_post_id
  left join public.village_support_replies reply on reply.id = p_reply_id
  left join public.village_support_posts reply_post on reply_post.id = reply.post_id;
  if village_uuid is null
    or not kinavela_private.can_access_village(village_uuid, true)
  then raise exception 'not_authorized'; end if;
  perform kinavela_private.remove_village_support_content(
    p_post_id, p_reply_id, profile_uuid
  );
  insert into public.village_moderation_actions(
    village_id, actor_profile_id, actor_family_id, action_type, metadata
  ) values (
    village_uuid, profile_uuid, family_uuid,
    case when p_reply_id is null then 'support_post_removed' else 'support_reply_removed' end,
    jsonb_build_object(
      'post_id', p_post_id, 'reply_id', p_reply_id, 'reason', p_reason
    )
  );
  insert into public.audit_events(
    actor_profile_id, event_type, entity_type, entity_id, metadata
  ) values (
    profile_uuid, 'village_support_content_removed',
    case when p_reply_id is null then 'village_support_post' else 'village_support_reply' end,
    coalesce(p_reply_id, p_post_id),
    jsonb_build_object('village_id', village_uuid, 'reason', p_reason)
  );
  return true;
end;
$$;

alter table public.reports
  add column target_support_post_id uuid
    references public.village_support_posts(id) on delete set null,
  add column target_support_reply_id uuid
    references public.village_support_replies(id) on delete set null;

alter table public.reports drop constraint reports_target_type_check;
alter table public.reports drop constraint reports_target_shape_check;
alter table public.reports drop constraint reports_reason_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in (
    'family', 'message', 'village', 'event', 'support_post', 'support_reply'
  ));
alter table public.reports add constraint reports_target_shape_check check (
  (target_type = 'family' and target_family_id is not null
    and target_message_id is null and conversation_id is null
    and target_village_id is null and target_event_id is null
    and target_support_post_id is null and target_support_reply_id is null)
  or (target_type = 'message' and target_family_id is not null
    and target_message_id is not null and conversation_id is not null
    and target_event_id is null and target_support_post_id is null
    and target_support_reply_id is null)
  or (target_type = 'village' and target_village_id is not null
    and target_family_id is null and target_message_id is null
    and conversation_id is null and target_event_id is null
    and target_support_post_id is null and target_support_reply_id is null)
  or (target_type = 'event' and target_event_id is not null
    and target_village_id is not null and target_family_id is null
    and target_message_id is null and conversation_id is null
    and target_support_post_id is null and target_support_reply_id is null)
  or (target_type = 'support_post' and target_support_post_id is not null
    and target_support_reply_id is null and target_village_id is not null
    and target_family_id is not null and target_message_id is null
    and conversation_id is null and target_event_id is null)
  or (target_type = 'support_reply' and target_support_post_id is not null
    and target_support_reply_id is not null and target_village_id is not null
    and target_family_id is not null and target_message_id is null
    and conversation_id is null and target_event_id is null)
);
alter table public.reports add constraint reports_reason_check check (reason in (
  'harassment', 'spam', 'fraud', 'unsafe_behavior', 'inappropriate_child_content',
  'discrimination', 'impersonation', 'unsafe_location', 'inappropriate_conduct',
  'misleading_event', 'child_safety_concern', 'privacy_exposure', 'unsafe_advice',
  'outdated_or_misleading', 'other'
));

create index reports_target_support_post_idx
  on public.reports(target_support_post_id, status, created_at desc);
create index reports_target_support_reply_idx
  on public.reports(target_support_reply_id, status, created_at desc);

create or replace function kinavela_private.prepare_report_triage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.reason in ('child_safety_concern', 'inappropriate_child_content') then
    new.severity := 'critical';
    new.urgent_child_safety := true;
  elsif new.reason in (
    'unsafe_location', 'unsafe_behavior', 'inappropriate_conduct',
    'privacy_exposure', 'unsafe_advice'
  ) then
    new.severity := 'high';
  elsif new.reason in (
    'fraud', 'discrimination', 'harassment', 'misleading_event'
  ) then
    new.severity := 'medium';
  else
    new.severity := 'low';
  end if;
  new.response_due_at := new.created_at + case new.severity
    when 'critical' then interval '1 hour'
    when 'high' then interval '24 hours'
    when 'medium' then interval '72 hours'
    else interval '7 days'
  end;
  return new;
end;
$$;

create or replace function kinavela_private.enforce_report_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare recent_reports integer;
begin
  new.details := nullif(btrim(coalesce(new.details, '')), '');
  if new.details is not null and char_length(new.details) > 1000 then
    raise exception 'invalid_report_details';
  end if;
  perform pg_advisory_xact_lock(
    hashtextextended('report-rate:' || new.reporter_profile_id::text, 0)
  );
  select count(*) into recent_reports from public.reports
  where reporter_profile_id = new.reporter_profile_id
    and created_at >= clock_timestamp() - interval '24 hours';
  if recent_reports >= 5 then raise exception 'report_rate_limited'; end if;
  if not exists (
    select 1 from public.family_members member
    join public.profiles profile on profile.id = member.profile_id
    where member.family_id = new.reporter_family_id
      and member.profile_id = new.reporter_profile_id
      and member.status = 'active' and profile.status = 'active'
  ) then raise exception 'not_authorized'; end if;

  if new.target_type = 'family' then
    if new.target_message_id is not null or new.conversation_id is not null
      or new.target_village_id is not null or new.target_event_id is not null
      or new.target_support_post_id is not null
      or new.target_support_reply_id is not null
      or not exists (
        select 1 from public.family_connections connection
        where new.reporter_family_id in (
          connection.requester_family_id, connection.recipient_family_id
        ) and new.target_family_id in (
          connection.requester_family_id, connection.recipient_family_id
        )
      ) then raise exception 'report_target_not_available'; end if;
  elsif new.target_type = 'village' then
    if new.target_event_id is not null or new.target_support_post_id is not null
      or new.target_support_reply_id is not null
      or not kinavela_private.is_village_family_member(
        new.target_village_id, new.reporter_family_id, false
      ) then raise exception 'report_target_not_available'; end if;
  elsif new.target_type = 'message' then
    if new.target_event_id is not null or new.target_support_post_id is not null
      or new.target_support_reply_id is not null or not exists (
        select 1 from public.messages message
        join public.conversations conversation on conversation.id = message.conversation_id
        where message.id = new.target_message_id
          and message.conversation_id = new.conversation_id
          and message.sender_family_id = new.target_family_id
          and (
            (conversation.conversation_type = 'family'
              and kinavela_private.can_access_family_conversation(
                conversation.id, true
              ))
            or (conversation.conversation_type = 'village'
              and conversation.village_id = new.target_village_id
              and kinavela_private.is_village_family_member(
                conversation.village_id, new.reporter_family_id, false
              ))
          )
      ) then raise exception 'report_target_not_available'; end if;
  elsif new.target_type = 'event' then
    if new.target_support_post_id is not null
      or new.target_support_reply_id is not null or not exists (
        select 1 from public.events event
        where event.id = new.target_event_id
          and event.village_id = new.target_village_id
          and event.creator_family_id <> new.reporter_family_id
          and kinavela_private.is_village_family_member(
            event.village_id, new.reporter_family_id, false
          )
      ) then raise exception 'report_target_not_available'; end if;
  elsif new.target_type = 'support_post' then
    if not exists (
      select 1 from public.village_support_posts post
      where post.id = new.target_support_post_id
        and post.village_id = new.target_village_id
        and post.author_family_id = new.target_family_id
        and post.author_family_id <> new.reporter_family_id
        and post.status <> 'removed'
        and kinavela_private.is_village_family_member(
          post.village_id, new.reporter_family_id, false
        )
    ) then raise exception 'report_target_not_available'; end if;
  elsif new.target_type = 'support_reply' then
    if not exists (
      select 1 from public.village_support_replies reply
      join public.village_support_posts post on post.id = reply.post_id
      where reply.id = new.target_support_reply_id
        and post.id = new.target_support_post_id
        and post.village_id = new.target_village_id
        and reply.author_family_id = new.target_family_id
        and reply.author_family_id <> new.reporter_family_id
        and reply.removed_at is null and post.status <> 'removed'
        and kinavela_private.is_village_family_member(
          post.village_id, new.reporter_family_id, false
        )
    ) then raise exception 'report_target_not_available'; end if;
  else
    raise exception 'invalid_report_target';
  end if;
  return new;
end;
$$;

create or replace function public.submit_village_support_report(
  p_post_id uuid,
  p_reply_id uuid,
  p_reason text,
  p_details text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_uuid uuid := public.current_profile_id();
  family_uuid uuid := kinavela_private.current_family_id(false);
  post_row public.village_support_posts%rowtype;
  reply_row public.village_support_replies%rowtype;
  target_family_uuid uuid;
  report_uuid uuid;
begin
  if p_reason not in (
    'privacy_exposure', 'unsafe_advice', 'harassment', 'discrimination',
    'fraud', 'child_safety_concern', 'outdated_or_misleading', 'other'
  ) then raise exception 'invalid_report_reason'; end if;
  select * into post_row from public.village_support_posts
  where id = p_post_id and status <> 'removed';
  if post_row.id is null
    or not kinavela_private.can_access_village(post_row.village_id, false)
  then raise exception 'support_post_not_available'; end if;
  if p_reply_id is not null then
    select * into reply_row from public.village_support_replies
    where id = p_reply_id and post_id = post_row.id and removed_at is null;
    if reply_row.id is null then raise exception 'support_reply_not_available'; end if;
    target_family_uuid := reply_row.author_family_id;
  else
    target_family_uuid := post_row.author_family_id;
  end if;
  if target_family_uuid = family_uuid then
    raise exception 'report_target_not_available';
  end if;
  insert into public.reports(
    reporter_profile_id, reporter_family_id, target_type, target_family_id,
    target_village_id, target_support_post_id, target_support_reply_id,
    reason, details
  ) values (
    profile_uuid, family_uuid,
    case when p_reply_id is null then 'support_post' else 'support_reply' end,
    target_family_uuid, post_row.village_id, post_row.id, p_reply_id,
    p_reason, p_details
  ) returning id into report_uuid;
  insert into public.audit_events(
    actor_profile_id, event_type, entity_type, entity_id
  ) values (profile_uuid, 'report_submitted', 'report', report_uuid);
  return report_uuid;
end;
$$;

drop function if exists public.list_village_reports(uuid);
create function public.list_village_reports(p_village_id uuid)
returns table (
  report_id uuid,
  target_type text,
  target_family_id uuid,
  target_family_name text,
  target_message_id uuid,
  target_event_id uuid,
  target_event_title text,
  target_support_post_id uuid,
  target_support_post_title text,
  target_support_reply_id uuid,
  reason text,
  details text,
  status text,
  severity text,
  urgent_child_safety boolean,
  response_due_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not kinavela_private.can_access_village(p_village_id, true) then
    raise exception 'not_authorized';
  end if;
  return query
  select report.id, report.target_type, report.target_family_id, family.name,
    report.target_message_id, report.target_event_id, event.title,
    report.target_support_post_id, support_post.title,
    report.target_support_reply_id, report.reason, report.details,
    report.status, report.severity, report.urgent_child_safety,
    report.response_due_at, report.created_at
  from public.reports report
  left join public.families family on family.id = report.target_family_id
  left join public.events event on event.id = report.target_event_id
  left join public.village_support_posts support_post
    on support_post.id = report.target_support_post_id
  where report.target_village_id = p_village_id
    and report.status in ('open', 'reviewing')
  order by report.urgent_child_safety desc, report.response_due_at, report.created_at;
end;
$$;

create or replace function public.resolve_village_report(
  p_report_id uuid,
  p_resolution text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_uuid uuid := public.current_profile_id();
  family_uuid uuid := kinavela_private.current_family_id(false);
  report_row public.reports%rowtype;
  target_role text;
  previous_status text;
begin
  if p_resolution not in (
    'dismiss', 'delete_message', 'remove_member', 'escalate',
    'cancel_event', 'restrict_event', 'delete_support_content'
  ) then raise exception 'invalid_resolution'; end if;
  select * into report_row from public.reports
  where id = p_report_id and status in ('open', 'reviewing') for update;
  if report_row.id is null or report_row.target_village_id is null
    or not kinavela_private.can_access_village(report_row.target_village_id, true)
  then raise exception 'report_not_available'; end if;
  if report_row.urgent_child_safety and p_resolution = 'dismiss' then
    raise exception 'urgent_report_requires_staff_review';
  end if;
  previous_status := report_row.status;
  if p_resolution = 'delete_message' then
    if report_row.target_message_id is null then raise exception 'invalid_resolution'; end if;
    update public.messages set deleted_at = now()
    where id = report_row.target_message_id
      and conversation_id = report_row.conversation_id and deleted_at is null;
    if not found then raise exception 'message_not_available'; end if;
    insert into public.village_moderation_actions(
      village_id, actor_profile_id, actor_family_id, action_type,
      target_family_id, target_message_id, report_id
    ) values (
      report_row.target_village_id, profile_uuid, family_uuid, 'message_removed',
      report_row.target_family_id, report_row.target_message_id, report_row.id
    );
    update public.reports set status = 'reviewing' where id = report_row.id;
  elsif p_resolution = 'delete_support_content' then
    if report_row.target_support_post_id is null then
      raise exception 'invalid_resolution';
    end if;
    perform kinavela_private.remove_village_support_content(
      case when report_row.target_support_reply_id is null
        then report_row.target_support_post_id else null end,
      report_row.target_support_reply_id, profile_uuid
    );
    insert into public.village_moderation_actions(
      village_id, actor_profile_id, actor_family_id, action_type,
      target_family_id, report_id, metadata
    ) values (
      report_row.target_village_id, profile_uuid, family_uuid,
      case when report_row.target_support_reply_id is null
        then 'support_post_removed' else 'support_reply_removed' end,
      report_row.target_family_id, report_row.id,
      jsonb_build_object(
        'post_id', report_row.target_support_post_id,
        'reply_id', report_row.target_support_reply_id
      )
    );
    update public.reports set status = 'reviewing' where id = report_row.id;
  elsif p_resolution = 'remove_member' then
    if report_row.target_family_id is null then raise exception 'invalid_resolution'; end if;
    select role into target_role from public.village_members
    where village_id = report_row.target_village_id
      and family_id = report_row.target_family_id and status = 'active';
    if target_role is null or target_role = 'owner' then raise exception 'not_authorized'; end if;
    perform public.remove_village_member(
      report_row.target_village_id, report_row.target_family_id
    );
    update public.reports set status = 'reviewing' where id = report_row.id;
  elsif p_resolution in ('cancel_event', 'restrict_event') then
    if report_row.target_event_id is null then raise exception 'invalid_resolution'; end if;
    perform kinavela_private.moderate_report_event(
      report_row.target_event_id, profile_uuid, p_resolution
    );
    update public.reports set status = 'reviewing' where id = report_row.id;
  elsif p_resolution = 'escalate' then
    update public.reports set
      status = 'reviewing',
      severity = case when severity in ('low', 'medium') then 'high' else severity end,
      response_due_at = least(response_due_at, now() + interval '24 hours')
    where id = report_row.id;
  else
    insert into public.village_moderation_actions(
      village_id, actor_profile_id, actor_family_id, action_type,
      target_family_id, target_message_id, report_id
    ) values (
      report_row.target_village_id, profile_uuid, family_uuid, 'report_dismissed',
      report_row.target_family_id, report_row.target_message_id, report_row.id
    );
    update public.reports set status = 'dismissed' where id = report_row.id;
  end if;
  insert into public.report_action_history(
    report_id, actor_profile_id, action_type, previous_status, new_status, severity
  )
  select report_row.id, profile_uuid,
    case p_resolution
      when 'cancel_event' then 'event_cancelled'
      when 'restrict_event' then 'event_restricted'
      when 'delete_support_content' then 'support_content_removed'
      when 'escalate' then 'escalated'
      when 'dismiss' then 'dismissed'
      else 'escalated'
    end,
    previous_status, status, severity
  from public.reports where id = report_row.id;
  return true;
end;
$$;

alter table public.report_action_history
  drop constraint report_action_history_action_type_check;
alter table public.report_action_history
  add constraint report_action_history_action_type_check check (action_type in (
    'submitted', 'assigned', 'note_added', 'severity_changed', 'escalated',
    'event_cancelled', 'event_restricted', 'support_content_removed',
    'resolved', 'dismissed'
  ));

drop function if exists public.admin_list_reports(text, integer);
create function public.admin_list_reports(p_status text default null, p_limit integer default 100)
returns table (
  report_id uuid,
  target_type text,
  target_family_id uuid,
  target_message_id uuid,
  target_village_id uuid,
  target_event_id uuid,
  target_event_title text,
  target_support_post_id uuid,
  target_support_post_title text,
  target_support_reply_id uuid,
  reason text,
  details text,
  status text,
  severity text,
  urgent_child_safety boolean,
  assigned_to_profile_id uuid,
  response_due_at timestamptz,
  resolution_notes text,
  reporter_profile_id uuid,
  action_count bigint,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not kinavela_private.is_admin(public.current_profile_id()) then
    raise exception 'admin_required';
  end if;
  if p_status is not null
    and p_status not in ('open', 'reviewing', 'resolved', 'dismissed')
  then raise exception 'invalid_report_status'; end if;
  return query
  select report.id, report.target_type, report.target_family_id,
    report.target_message_id, report.target_village_id, report.target_event_id,
    event.title, report.target_support_post_id, support_post.title,
    report.target_support_reply_id, report.reason, report.details, report.status,
    report.severity, report.urgent_child_safety, report.assigned_to_profile_id,
    report.response_due_at, report.resolution_notes, report.reporter_profile_id,
    (select count(*) from public.report_action_history history
      where history.report_id = report.id),
    report.created_at, report.updated_at
  from public.reports report
  left join public.events event on event.id = report.target_event_id
  left join public.village_support_posts support_post
    on support_post.id = report.target_support_post_id
  where p_status is null or report.status = p_status
  order by report.urgent_child_safety desc, report.response_due_at, report.created_at
  limit least(greatest(coalesce(p_limit, 100), 1), 200);
end;
$$;

create or replace function public.admin_manage_report(
  p_report_id uuid,
  p_action text,
  p_severity text default null,
  p_note text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_uuid uuid := public.current_profile_id();
  report_row public.reports%rowtype;
  clean_note text := nullif(btrim(coalesce(p_note, '')), '');
  new_status text;
begin
  if not kinavela_private.is_admin(actor_uuid) then raise exception 'admin_required'; end if;
  if p_action not in (
    'assign_to_me', 'add_note', 'set_severity', 'resolve', 'dismiss',
    'cancel_event', 'restrict_event', 'delete_support_content'
  ) then raise exception 'invalid_report_action'; end if;
  if p_severity is not null
    and p_severity not in ('low', 'medium', 'high', 'critical')
  then raise exception 'invalid_report_severity'; end if;
  if clean_note is not null and char_length(clean_note) > 1000 then
    raise exception 'invalid_report_note';
  end if;
  if p_action in (
    'add_note', 'resolve', 'dismiss', 'cancel_event', 'restrict_event',
    'delete_support_content'
  ) and clean_note is null then raise exception 'report_note_required'; end if;
  select * into report_row from public.reports where id = p_report_id for update;
  if report_row.id is null then raise exception 'report_not_found'; end if;
  if p_action = 'assign_to_me' then
    update public.reports set assigned_to_profile_id = actor_uuid,
      assigned_at = now(), status = 'reviewing' where id = p_report_id;
  elsif p_action = 'set_severity' then
    if p_severity is null then raise exception 'invalid_report_severity'; end if;
    update public.reports set severity = p_severity,
      urgent_child_safety = urgent_child_safety or p_severity = 'critical',
      response_due_at = least(
        coalesce(response_due_at, 'infinity'::timestamptz),
        now() + case p_severity
          when 'critical' then interval '1 hour'
          when 'high' then interval '24 hours'
          when 'medium' then interval '72 hours'
          else interval '7 days'
        end
      ) where id = p_report_id;
  elsif p_action = 'add_note' then
    update public.reports set status = 'reviewing' where id = p_report_id;
  elsif p_action in ('cancel_event', 'restrict_event') then
    if report_row.target_event_id is null then raise exception 'invalid_report_action'; end if;
    perform kinavela_private.moderate_report_event(
      report_row.target_event_id, actor_uuid, p_action
    );
    update public.reports set status = 'reviewing' where id = p_report_id;
  elsif p_action = 'delete_support_content' then
    if report_row.target_support_post_id is null then
      raise exception 'invalid_report_action';
    end if;
    perform kinavela_private.remove_village_support_content(
      case when report_row.target_support_reply_id is null
        then report_row.target_support_post_id else null end,
      report_row.target_support_reply_id, actor_uuid
    );
    update public.reports set status = 'reviewing' where id = p_report_id;
  else
    update public.reports set
      status = case when p_action = 'resolve' then 'resolved' else 'dismissed' end,
      resolution_notes = clean_note where id = p_report_id;
  end if;
  select status into new_status from public.reports where id = p_report_id;
  insert into public.report_action_history(
    report_id, actor_profile_id, action_type, previous_status, new_status,
    severity, note
  ) values (
    p_report_id, actor_uuid,
    case p_action
      when 'assign_to_me' then 'assigned'
      when 'add_note' then 'note_added'
      when 'set_severity' then 'severity_changed'
      when 'cancel_event' then 'event_cancelled'
      when 'restrict_event' then 'event_restricted'
      when 'delete_support_content' then 'support_content_removed'
      when 'resolve' then 'resolved'
      else 'dismissed'
    end,
    report_row.status, new_status, coalesce(p_severity, report_row.severity), clean_note
  );
  insert into public.audit_events(
    actor_profile_id, event_type, entity_type, entity_id, metadata
  ) values (
    actor_uuid, 'report_moderation_action', 'report', p_report_id,
    jsonb_build_object(
      'action', p_action, 'severity', coalesce(p_severity, report_row.severity)
    )
  );
  return true;
end;
$$;

revoke all on function kinavela_private.assert_support_content(text),
  kinavela_private.remove_village_support_content(uuid,uuid,uuid)
from public, anon, authenticated, service_role;

revoke all on function public.create_village_support_post(
    uuid,text,text,text,text,boolean
  ), public.reply_to_village_support_post(uuid,text,boolean),
  public.close_village_support_post(uuid),
  public.list_village_support_posts(uuid,text,text,text,text,timestamptz,integer),
  public.moderate_village_support_content(uuid,uuid,text),
  public.submit_village_support_report(uuid,uuid,text,text),
  public.list_village_reports(uuid),
  public.resolve_village_report(uuid,text),
  public.admin_list_reports(text,integer),
  public.admin_manage_report(uuid,text,text,text)
from public, anon, authenticated, service_role;

grant execute on function public.create_village_support_post(
    uuid,text,text,text,text,boolean
  ), public.reply_to_village_support_post(uuid,text,boolean),
  public.close_village_support_post(uuid),
  public.list_village_support_posts(uuid,text,text,text,text,timestamptz,integer),
  public.moderate_village_support_content(uuid,uuid,text),
  public.submit_village_support_report(uuid,uuid,text,text),
  public.list_village_reports(uuid),
  public.resolve_village_report(uuid,text)
to authenticated;

grant execute on function public.admin_list_reports(text,integer),
  public.admin_manage_report(uuid,text,text,text)
to authenticated;

insert into kinavela_private.schema_migrations(version)
values ('202608130010_village_support_board');

notify pgrst, 'reload schema';
commit;
