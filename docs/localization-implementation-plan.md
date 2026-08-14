# Complete German and French localization implementation plan

## Status

Implementation plan based on the localization audit performed on 13 August 2026.
Localization Phases L0, L1, L2, L3, L4, L5, and L6 are complete; see
`docs/phase-l0-localization-foundation.md`,
`docs/phase-l1-legal-safety-localization.md`, and
`docs/phase-l2-cultural-mission-drafts.md`,
`docs/phase-l3-public-localization.md`, and
`docs/phase-l4-authenticated-localization.md`, and
`docs/phase-l5-communications-localization.md`, and
`docs/phase-l6-localization-qualification.md`. The remaining phases use the `L` prefix
so they do not change or conflict with Kinavela's existing product phase numbers.

## Objective

Deliver a complete and coherent German, French, and English experience for
every text a user can see, hear, download, install, or receive.

This includes more than application dictionaries. Completion covers:

- public and authenticated pages;
- legal, privacy, safety, consent, suspension, and moderation copy;
- form labels, options, placeholders, validation, errors, empty states, and
  confirmations;
- accessibility names, image alternatives, browser titles, and metadata;
- database-supplied catalogue and reference content;
- emails, push notifications, invitation previews, and shared messages;
- PWA installation, offline behavior, and service-worker fallbacks;
- generated files and personal-data exports;
- dates, times, numbers, currencies, and locale-sensitive names;
- operator interfaces when the operator has selected German or French.

User-generated text, email addresses, postal addresses, trademarks, product
names such as Kinavela, and community or personal names are not translated.
Community-language words and culturally specific names remain in their source
language, with localized explanatory copy where needed.

## Product and engineering rules

1. The selected interface locale is the only source of truth for product copy
   and locale-sensitive formatting. Browser or server defaults must not silently
   choose another language.
2. No German or French route may intentionally fall back to English for
   user-visible product content. A missing translation must fail tests or content
   publication instead.
3. Stable identifiers, API error codes, database enum values, and analytics
   event names remain language-neutral. They are mapped to localized display
   copy at the presentation boundary.
4. Database content must have an explicit translation model and publication
   completeness checks. Displaying an English database field on another locale
   is not acceptable.
5. Legal and child-safety translations require qualified human review. Cultural
   mission translations require both linguistic and cultural/editorial review.
6. User-supplied content is shown as supplied. The interface must never imply
   that user content was translated unless a translation was explicitly created.
7. Accessibility text has the same translation requirement as visible text.
8. New features cannot pass release qualification if they introduce unapproved
   hardcoded user-facing strings.

---

## Localization Phase L0 — Inventory, architecture, and guardrails

### Goal

Create one enforceable localization contract before translating the remaining
content, so future work does not reintroduce English-only text.

### Implementation

- Create a machine-readable inventory of user-facing text surfaces, grouped by:
  UI, accessibility, database content, legal content, email, push, sharing,
  PWA, metadata, exports, and operator tooling.
- Record an owner and translation mechanism for every surface.
- Establish one naming convention for application translation keys. Keep
  feature-owned dictionaries where they are useful, but require identical
  German, French, and English shapes.
- Add locale-aware helpers for dates, times, numbers, currencies, lists, and
  relative time. Remove direct formatting that relies on an undefined locale.
- Define a localized reference-data projection for countries, cultures, and
  languages. Preserve stable database IDs and ISO codes.
- Define a localized cultural-content projection for missions and mission steps.
  Translation storage may use normalized translation tables or versioned JSON,
  but it must support review status, source locale, content version, and all
  three required locales.
- Add a translation completeness checker that examines application dictionaries,
  feature dictionaries, localized database fixtures, email/push mappings,
  metadata, and PWA fallbacks.
- Add a source scan for literal user-facing JSX attributes and text. Maintain a
  small reviewed allowlist for brand names, native language names, test fixtures,
  and non-user-facing logs.
- Document how a developer adds or changes user-facing copy.

### Tests and acceptance

- Dictionary parity and non-empty checks pass for all three locales.
- Formatting helpers are tested with fixed German, French, and English outputs.
- The source scan detects a deliberately introduced hardcoded JSX label,
  placeholder, accessibility label, and service-worker fallback.
- Database fixtures fail validation when any required translation is absent or
  unreviewed.
- The inventory contains every gap identified in the 13 August audit.

### Deliverable

A localization contract, coverage script, formatting utilities, translation
data design, and initial CI gate. No surface is declared complete in L0 merely
because dictionary parity passes.

---

## Localization Phase L1 — Legal, safety, consent, and account-state content

### Goal

Translate the highest-risk content first and ensure every user can understand
their rights, obligations, safety rules, and account status.

### Implementation

- Create complete German and French versions of:
  - privacy policy;
  - terms of service;
  - Impressum surrounding copy;
  - cookie and browser-storage policy;
  - child-safety policy;
  - community guidelines.
- Localize legal navigation, document metadata, headings, table headers,
  contacts, consent descriptions, and accessibility labels.
- Keep a shared legal document version and effective date across locales, while
  allowing each translation to record its review date and reviewer.
- Localize the suspended-account page, moderation-review explanation, support
  path, and return navigation.
- Review privacy and metrics-consent interfaces for strings outside the main
  dictionary.
- Establish a controlled legal-copy update process: source change, translation
  change, legal review, version bump, tests, and deployment together.

### Review requirement

- German and French documents must be reviewed by qualified legal counsel or an
  explicitly designated legal reviewer.
- Child-safety and community-guideline translations must also receive safety and
  moderation review.
- Automated or machine translation may be used only as a draft, never as the
  final reviewed text.

### Tests and acceptance

- Every legal route renders the correct language for `de`, `fr`, and `en`.
- Route metadata and document-language attributes match the selected locale.
- Snapshot or semantic tests verify all legal sections, navigation items, and
  effective-version markers in each locale.
- No English legal prose is present on German or French pages, excluding company
  names, service names, addresses, and approved legal terminology.
- Suspended users receive localized explanations and recovery directions.

### Deliverable

Reviewed, versioned legal and safety content with localized account-state pages.

---

## Localization Phase L2 — Cultural missions and reference data

### Goal

Prevent English database records from leaking into German and French workflows.

### Database and content model

- Add localized mission content for every published mission and step, covering:
  title, summary, description, cultural context, materials, guardian guidance,
  respectful attribution, reflection prompt, step title, and step description.
- Store source locale, translation locale, content version, review status,
  reviewer, and review timestamp.
- Require a complete reviewed German, French, and English content set before a
  mission can be published to all locales.
- Ensure mission-list and mission-detail RPCs accept a validated locale and
  return only the requested reviewed translation.
- Ensure offline mission snapshots contain the selected locale and cannot reuse
  a snapshot from another locale without an explicit locale label.
- Add localized display names for countries, cultures, and languages. Use ISO
  codes and stable IDs for lookup; use native names only where the UI deliberately
  calls for a native-language label.
- Localize public community geography labels such as Germany, Munich, and
  Frankfurt when their localized forms differ.
- Preserve culturally specific names such as Bamiléké, Bassa, Beti, Duala,
  Basaa, Ewondo, and Medumba unless the editorial review defines an accepted
  language-specific form.

### Editorial workflow

- Translate the English reviewed mission catalogue into German and French.
- Perform linguistic review for clarity, age appropriateness, safeguarding
  language, consent language, and reading level.
- Perform cultural review without flattening distinct Cameroonian communities or
  presenting one family's practice as universal.
- Record approval per mission, locale, and content version.

### Tests and acceptance

- Database assertions reject publication with a missing, stale, or unreviewed
  required translation.
- Mission RPC tests prove locale isolation and safe rejection of unsupported
  locale input.
- UI tests render a complete mission, including preparation, steps, and
  reflection, in each locale.
- Onboarding, settings, discovery filters, Roots Passport, and mission pages use
  localized reference labels.
- German and French offline snapshots contain no English catalogue fields.

### Migration requirement

Use additive migrations. Preserve existing mission, step, progress, assignment,
and Roots Passport relationships; do not replace stable IDs merely to add
translations.

### Deliverable

A fully reviewed multilingual mission catalogue and localized reference-data
pipeline.

---

## Localization Phase L3 — Public website, discovery acquisition, SEO, and PWA

### Goal

Make every pre-authentication and installable-app surface consistently match the
visitor's selected locale.

### Public website

- Move the remaining landing-page strings into localized copy:
  sign-in navigation, illustration labels, privacy emblem, call-to-action
  eyebrow, footer links, contact link, and all accessibility navigation labels.
- Localize public community navigation, privacy link, forming-state heading,
  aggregate-only footer, and accessibility labels.
- Remove English city labels from German and French metadata descriptions and
  body copy.
- Audit invitation landing pages, authentication pages, confirmation redirects,
  and public recording links for both visible and accessibility text.

### SEO and document language

- Provide locale-specific page titles, descriptions, Open Graph values, and
  alternate-language links for all indexable localized pages.
- Ensure the final HTML language matches the route during initial rendering and
  after client navigation.
- Localize structured-data descriptions where the data is language-sensitive.
- Keep canonical and alternate URLs stable and prevent localized pages from
  being treated as duplicate English content.

### PWA and offline behavior

- Serve localized PWA names/descriptions or an approved locale-aware manifest
  strategy instead of one German manifest carrying an English description.
- Localize the service worker's fallback notification body.
- Preserve the locale when offline navigation falls back to the offline page.
- Verify install prompts, shortcuts if added, offline headings, cached mission
  data, and reconnect messages in all three locales.
- Increment cache versions when localized shell content changes.

### Tests and acceptance

- Public page tests assert representative German, French, and English content and
  accessibility names.
- Metadata tests verify title, description, alternates, Open Graph, manifest, and
  document language per locale.
- Service-worker tests cover a missing/invalid push body and locale-preserving
  offline fallback.
- Browser tests cover public landing, community acquisition, signup/login,
  invitation, story-recording, install prompt, and offline page in all locales.

### Deliverable

Complete localized acquisition, authentication-entry, metadata, accessibility,
and PWA surfaces.

---

## Localization Phase L4 — Authenticated application and operator interface

### Goal

Remove residual hardcoded English and locale-default formatting from daily use.

### Family application

- Localize playdate reporting reasons and every report confirmation/error state.
- Localize story-recorder defaults and status text, including “A family story”
  and “Recording”.
- Localize the discovery location editor's country label and reference value.
- Replace remaining hardcoded navigation and accessibility labels in the
  authenticated header and feature components.
- Route every date, time, number, currency, and relative-time display through the
  locale-aware helpers introduced in L0.
- Audit empty states, loading text, retry actions, placeholders, select options,
  confirmation dialogs, and visually hidden labels across all authenticated
  routes.
- Verify that changing the interface language updates current UI copy and future
  communication preferences without changing cultural-language selections.

### Operator application

- Add full German and French copy for moderation headings, tables, filters,
  actions, severities, review placeholders, status values, metrics, and dates.
- Localize safety-critical action confirmation language while retaining stable
  operation and severity codes internally.
- Keep user-generated report details and content in their original language;
  label the language when known rather than implying translation.

### Tests and acceptance

- Component tests cover every formerly hardcoded string in `de`, `fr`, and `en`.
- Authenticated browser journeys exercise onboarding, discovery, connections,
  messages, Villages, events, playdates, support, missions, Roots Passport,
  stories, notifications, billing, privacy controls, and settings per locale.
- Operator browser tests cover report review and verification review in all three
  locales.
- Locale-sensitive formatting is deterministic in tests and never depends on the
  CI host locale.
- The hardcoded-string scan has no unexplained findings in user-facing code.

### Deliverable

A completely localized family and operator application, including accessibility
and formatting.

---

## Localization Phase L5 — Received communications, errors, sharing, and exports

### Goal

Guarantee that content received outside a rendered page is localized and that
internal English errors never leak to users.

### Communications

- Revalidate every auth email, notification email, push notification, reminder,
  invitation preview, Web Share message, WhatsApp text, and referral message.
- Require exhaustive localized mappings for every notification kind. Adding a
  notification kind without three localized subjects/bodies must fail typecheck
  or tests.
- Verify locale selection at dispatch time and define behavior when the user
  changes locale after a delivery is queued.
- Use a privacy-safe localized fallback only when the payload does not contain a
  valid translated body.
- Verify plain-text and HTML email parts independently.

### Errors and validation

- Keep API responses language-neutral using stable error codes.
- Map every user-actionable code to localized copy in the client or localized
  server-rendering boundary.
- Do not render database, Stripe, SMTP, storage-provider, AI-provider, or raw
  exception messages to users.
- Log technical detail privately with correlation IDs; show a localized safe
  message and support path to the user.
- Localize rate-limit, offline, authentication-expiry, authorization, upload,
  processing, and unsupported-browser errors.

### Downloads and exports

- Review the personal-data export schema and document which values are stable
  machine fields versus user-facing labels.
- If exports are intended for direct human reading, include a localized README or
  localized field-label manifest while preserving a stable machine-readable JSON
  schema.
- Localize download descriptions, generated report headings, export status, and
  safe filenames where applicable.
- Preserve user-generated content and stored historical locale values exactly.

### Tests and acceptance

- Exhaustive notification tests cover every kind and every locale across email,
  push, and in-app labels.
- Contract tests prove raw provider/database messages cannot reach a rendered
  error state.
- Sharing tests verify localized text without exposing family, child, contact, or
  exact-location data.
- Export tests verify stable data, localized supporting material, UTF-8 content,
  and safe content-disposition headers.

### Deliverable

Localized and privacy-safe communications, error handling, sharing, and
downloads.

---

## Localization Phase L6 — End-to-end qualification and release

### Goal

Prove complete translation in realistic journeys and make localization coverage
a permanent release gate.

### Qualification matrix

Run each supported locale through:

1. public landing and community acquisition;
2. signup, email delivery, confirmation, login, recovery, and onboarding;
3. discovery, family settings, connections, messaging, blocking, and reporting;
4. Village creation, invitations, support, events, recurring events, and
   playdates;
5. cultural missions, offline mission access, Roots Passport, Roots Stories, and
   exports;
6. notification feed, email, push, preferences, and reminders;
7. billing, consent, privacy requests, account deletion, and suspension;
8. legal, child-safety, community-guideline, PWA install, and offline surfaces;
9. operator moderation and verification workflows.

### Automated release gate

- Run formatting, ESLint, TypeScript, unit tests, database assertions, security
  scan, production build, and desktop/mobile browser projects.
- Run the L0 localization coverage checker and hardcoded-string scan.
- Validate all published database content in a clean migrated database.
- Crawl all statically known localized routes and scan rendered visible text,
  accessibility names, metadata, and manifest responses.
- Exercise email and push rendering from fixtures for every delivery kind.
- Treat missing, stale, unreviewed, or English-fallback content as a release
  blocker.

### Human review

- Native or professionally qualified German and French reviewers complete the
  journey matrix on mobile and desktop.
- Legal/safety reviewers sign off the exact deployed document versions.
- Cultural reviewers sign off the exact deployed mission versions.
- Reviewers check meaning, tone, terminology consistency, truncation, plural and
  gender behavior, accents, typography, layout, screen-reader names, and locale
  formatting—not only the absence of English words.

### Production verification

- Deploy database translations and application changes using the normal staged
  deployment process.
- Smoke-test public HTTPS routes, localized manifests, authentication email,
  notification email, and push delivery against the deployed environment.
- Verify no cache serves content from a previously selected locale.
- Monitor translation-missing events, client errors, failed deliveries, and
  support reports after release without recording sensitive content.

### Exit criteria

Localization is complete only when:

- every inventory item is marked implemented and reviewed for `de`, `fr`, and
  `en`;
- all automated and human qualification checks pass;
- no German or French journey exposes unapproved English product copy;
- all published mission translations and legal/safety versions are reviewed;
- the production smoke tests pass for all locales; and
- localization coverage is part of the permanent release-qualification command.

### Deliverable

A signed localization qualification report and a release gate that prevents
regression.

---

## Recommended execution order

| Order | Phase                            | Dependency     | Release significance         |
| ----- | -------------------------------- | -------------- | ---------------------------- |
| 1     | L0 — Architecture and guardrails | None           | Establishes enforcement      |
| 2     | L1 — Legal and safety            | L0 conventions | Highest compliance risk      |
| 3     | L2 — Missions and reference data | L0 data design | Largest content body         |
| 4     | L3 — Public site and PWA         | L0 helpers     | Closes pre-auth gaps         |
| 5     | L4 — App and operator UI         | L0 helpers     | Closes daily-use gaps        |
| 6     | L5 — Communications and exports  | L0 contracts   | Closes received-content gaps |
| 7     | L6 — Qualification and release   | L1–L5          | Final release decision       |

L1 and the translation/editorial portion of L2 may proceed in parallel after
L0 defines their storage and review contracts. L3, L4, and L5 may also proceed
in parallel once the shared formatting and coverage utilities are stable.

## Required documentation during implementation

Each completed localization phase must add a short production record containing:

- exact scope delivered;
- migration identifiers, if any;
- translation and reviewer versions;
- automated test evidence;
- manual review evidence;
- deployment result;
- known exclusions; and
- rollback or correction procedure.

The changelog, privacy inventory, database documentation, deployment guide, and
release-qualification documentation must be updated whenever the implementation
changes their behavior.
