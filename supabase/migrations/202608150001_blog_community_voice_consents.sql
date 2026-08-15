begin;

-- Consent records for families quoted or photographed on the blog.
--
-- These live in kinavela_private, never in git. A blog post refers to a record
-- only by its opaque consent_ref, so the repository never carries the name,
-- contact details or signature of the person who agreed.
create table if not exists kinavela_private.blog_consents (
  consent_ref text primary key check (consent_ref ~ '^c_[a-z0-9]{6,40}$'),
  post_slug text not null check (post_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  -- Who agreed, and how to reach them if they later change their mind.
  subject_name text not null check (length(btrim(subject_name)) > 0),
  subject_contact text,
  -- Consent is specific: this scope, in these languages, for this post.
  scope text not null check (scope in ('quote', 'photo', 'quote_and_photo', 'interview')),
  -- cardinality(), not array_length(): array_length returns NULL for an empty
  -- array, and a CHECK that evaluates to NULL passes — so the obvious spelling
  -- would have allowed consent covering no languages at all. No default
  -- either: which languages someone agreed to is never a safe assumption.
  locales text[] not null check (
    locales <@ array['de', 'fr', 'en'] and cardinality(locales) > 0
  ),
  -- The site's own rule is that no identifiable child ever appears. The schema
  -- refuses to record consent that would contradict it: there is no guardian
  -- permission that makes an identifiable minor acceptable here, so this is a
  -- constraint rather than a flag someone could set.
  depicts_identifiable_minor boolean not null default false
    check (depicts_identifiable_minor = false),
  -- Path to the signed document in a private bucket, if one was collected.
  evidence_path text,
  granted_at timestamptz not null default now(),
  -- Withdrawal is a first-class state, not a deletion: the record of having
  -- withdrawn is what proves the request was honoured.
  withdrawn_at timestamptz,
  withdrawal_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (withdrawn_at is null or withdrawn_at >= granted_at)
);

create index if not exists blog_consents_post_slug_idx
  on kinavela_private.blog_consents (post_slug);
create index if not exists blog_consents_active_idx
  on kinavela_private.blog_consents (withdrawn_at)
  where withdrawn_at is null;

alter table kinavela_private.blog_consents enable row level security;
alter table kinavela_private.blog_consents force row level security;

-- No application role reads this table, service_role included: nothing the
-- site renders needs the identity behind a consent_ref, so the only way in is
-- a direct database connection (the DATABASE_URL that scripts/migrate.sh
-- already uses). Forced RLS with no policies means even the table owner is
-- excluded unless the connecting role holds BYPASSRLS, which is what makes the
-- inserts below work — the same arrangement as
-- kinavela_private.processing_activities.
revoke all on kinavela_private.blog_consents
  from public, anon, authenticated, service_role;

insert into kinavela_private.processing_activities(
  activity_key, purpose, data_categories, data_subjects, recipients,
  legal_basis, retention_rule, international_transfer, safeguards
)
values (
  'blog_community_voices',
  'Publish interviews, quotes and photographs of community members on the public blog',
  array['name', 'contact detail', 'quoted words', 'photograph', 'consent evidence'],
  array['adult community members who agreed to be featured'],
  array['Supabase Database', 'Supabase Storage', 'public website'],
  'explicit, specific, documented consent',
  'kept while the post is published, plus proof-of-withdrawal thereafter',
  'EU hosting where configured; the published post itself is world-readable',
  'consent stored outside git, referenced by opaque id; no identifiable children; no street-level locations; withdrawal path documented in docs/blog-consent-and-withdrawal.md'
)
on conflict (activity_key) do update set
  purpose = excluded.purpose,
  data_categories = excluded.data_categories,
  data_subjects = excluded.data_subjects,
  recipients = excluded.recipients,
  legal_basis = excluded.legal_basis,
  retention_rule = excluded.retention_rule,
  international_transfer = excluded.international_transfer,
  safeguards = excluded.safeguards,
  updated_at = now();

insert into kinavela_private.retention_policies(
  policy_key, resource, retention_days, action, enabled, notes
)
values (
  'blog_consent_review',
  'kinavela_private.blog_consents',
  365,
  'review',
  true,
  'Re-confirm annually that featured people still consent, and that withdrawn records have been honoured in the published post.'
)
on conflict (policy_key) do update set
  resource = excluded.resource,
  retention_days = excluded.retention_days,
  action = excluded.action,
  notes = excluded.notes,
  updated_at = now();

insert into kinavela_private.schema_migrations(version)
values ('202608150001_blog_community_voice_consents')
on conflict (version) do nothing;

notify pgrst, 'reload schema';

commit;
