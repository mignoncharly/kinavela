# Complete implementation plan

## Product rule

Adopt this as a hard requirement:

> Any authenticated family selecting a valid geocoded location in Germany may complete onboarding and use Kinavela immediately. City, regional density, active-family
> count, or pilot status must never block onboarding or later location changes.

Density information may improve suggestions and growth efforts, but it must not control admission.

———

## Phase 1 — Remove pilot admission blockers

### Goal

Allow onboarding and location changes for every valid German city, town, municipality, or postcode.

### Database

- Remove admission enforcement from families_enforce_pilot_limit.
- Stop calling kinavela_private.enforce_pilot_location from onboarding and location updates.
- Remove the 50-active-family cap.
- Eliminate dependency on exact pilot_regions city matches.
- Keep the requirement that the geocoded country is Germany.
- Continue accepting city, town, village, municipality, and postcode results from the geocoder.
- Preserve existing waitlist records temporarily for audit/export purposes; do not immediately delete historical data.

### Application

- Remove the pilot waitlist form from onboarding.
- Remove “open pilot area” and “join waitlist” messaging.
- Return clear errors only for:
  - invalid location;
  - non-German location;
  - geocoding failure;
  - authentication/validation failure.

- Ensure towns such as Schrobenhausen, Aresing, Manching, Karlskron, and every other German municipality work without being configured individually.

### Administration

- Replace pilot-region status controls with non-blocking regional density analytics.
- City status must no longer have open, paused, or waitlist effects.
- Optionally keep a read-only density dashboard for community outreach.

### Tests

Add database and API tests proving:

- arbitrary German municipalities can onboard;
- arbitrary German postcodes can onboard;
- location changes between German cities work;
- a non-German result is rejected if Germany remains the launch-country boundary;
- family counts and regional density never block onboarding;
- old pilot configuration cannot accidentally re-enable admission blocking.

———

## Phase 2 — Complete family profile management

### Goal

Let families keep their discovery information accurate after onboarding.

### Family editor

Add a dedicated family settings area for:

- family name;
- family bio;
- discovery visibility;
- approximate geocoded location;
- discovery radius;
- cultures and cultural relationships;
- cultural preservation goals;
- interests;
- matching priorities;
- openness to other African or diaspora families.

### Children management

Allow owners to:

- add a child;
- edit nickname;
- edit birth year/month;
- edit optional gender;
- remove a child with explicit confirmation;
- control child-related visibility.

Guardians should either receive explicit management permission or the UI should clearly explain that only the owner can make changes.

Children must remain family resources, never user accounts.

### Languages

Support multiple family languages rather than only one onboarding language.

For each language, support:

- proficiency;
- transmission goal;
- add/remove/update.

Keep cultural language independent from interface language.

### Availability

Allow multiple availability slots:

- all weekdays;
- morning;
- afternoon;
- evening.

Make availability editable and continue using it in matching and discovery filters.

### Location correctness

Remove the free-text Settings city update or replace it with the secure geocoded location flow. A profile city must not diverge from the family’s actual PostGIS discovery
location.

### Tests

Cover owner/guardian/member permissions, child privacy, location consistency, and matching changes after profile edits.

———

## Phase 3 — Complete multilingual support

### Goal

Provide a coherent German, French, and English experience from registration through daily use.

Localize:

- onboarding wizard;
- dashboard;
- Settings;
- privacy controls;
- notification feed;
- pilot-removal messages;
- validation errors;
- interest names;
- preservation goals;
- availability labels;
- billing messages;
- install/offline prompts.

Additional work:

- render interest name_key translations instead of raw slugs;
- preserve the selected language across authentication and onboarding;
- add automated dictionary-parity tests;
- add page-level tests for all three languages;
- avoid hard-coded English in client error messages and empty states.

———

## Phase 4 — WhatsApp-friendly invitations and referrals

### Goal

Let one mother turn a WhatsApp conversation into an active Kinavela community.

### General family referral

Add a secure referral link that:

- can be shared through WhatsApp, the Web Share API, copy-link, or email;
- contains no family, child, location, or contact data;
- can be opened before registration;
- preserves referral context through signup;
- expires or can be revoked where appropriate;
- records privacy-safe attribution.

### Village invitation links

Allow authorized Village members to invite an unregistered family.

The flow should be:

Share link
→ recipient views minimal Village information
→ recipient registers
→ completes family onboarding
→ explicitly accepts the Village invitation
→ Village membership is activated

The link must not bypass:

- geographic eligibility;
- Village capacity;
- blocks;
- guardian ownership;
- explicit consent.

### Event sharing

Support two safe modes:

- share an event with existing Village members;
- invite an unregistered family through a Village invitation associated with the event.

Do not make private Village events publicly discoverable or expose exact addresses.

### Sharing UX

Provide:

- “Share on WhatsApp”;
- native mobile Share;
- “Copy invitation link”;
- localized invitation preview text.

———

## Phase 5 — Low-density activation without access blockers

### Goal

Help a family make progress even when few nearby families exist.

### Discovery empty state

When no results exist, offer:

- increase radius;
- remove overly narrow filters;
- search the wider region;
- create a Village;
- invite another family;
- request notification when compatible families appear.

Radius expansion must always respect the family’s explicit maximum radius.

### New-family alerts

Create a privacy-preserving subscription such as:

Notify me when a compatible family becomes discoverable within 40 km.

Alerts must:

- contain no candidate identity until normal discovery is opened;
- respect both families’ discovery radii;
- respect visibility and blocks;
- avoid repeatedly alerting about the same candidate;
- be revocable;
- use in-app notification by default, with optional consented email/push.

### Regional suggestions

Suggest:

- nearby Villages;
- compatible families in a wider radius;
- existing cultural clusters;
- the possibility of creating a new Cameroon-focused Village.

### Village clustering

Keep the existing aggregate cluster detector, but remove its role as an admission mechanism. It should only suggest community formation.

### Remove waitlist UX

Do not replace the current waitlist with another hidden access gate. “Notify me when families appear” is a product alert, not a waitlist and not an onboarding
restriction.

———

## Phase 6 — Trust and child-meeting safety

### Goal

Strengthen “trusted community” before positioning Kinavela as suitable for child-related real-world meetings.

### Verification progression

Implement real workflows for the existing verification levels:

- email verified;
- optional phone verified;
- community verified;
- optionally identity verified later.

Community verification could be based on:

- endorsement by established verified families;
- Village moderator review;
- manual staff review.

Verification must never claim that a person is safe. It should state exactly what was verified.

### Meeting safety

Before a family’s first offline RSVP or meeting confirmation, show concise guidance:

- meet in a public place initially;
- do not share school or child contact details;
- guardians remain responsible for supervision;
- control address sharing;
- use block/report if uncomfortable;
- contact emergency services for immediate danger.

### Event reporting

Add event as a report target across:

- database schema;
- validation;
- API;
- event UI;
- Village moderation;
- global admin moderation.

Allow fixed reasons such as:

- unsafe location;
- inappropriate conduct;
- misleading event;
- child-safety concern;
- discrimination;
- fraud;
- other.

### Moderation

Add:

- report assignment and notes;
- severity;
- urgent child-safety classification;
- action history;
- event cancellation/restriction;
- clear escalation workflow;
- operational response targets.

Do not copy private message bodies or exact addresses into analytics.

### Policy consistency

Update Community Guidelines and Child Safety Policy so every claimed reporting capability corresponds to working code.

———

## Phase 7 — Structured mutual support in Germany

### Goal

Support everyday practical help without introducing a public social feed.

Implement this inside Villages as a bounded support/questions feature.

### Content types

- question;
- help request;
- recommendation request;
- resource;
- announcement;
- offer of help.

### Categories

- Kita;
- school;
- German language;
- administration;
- immigration/integration experience;
- healthcare navigation;
- local family services;
- transport;
- childcare coordination;
- local recommendations;
- other practical support.

### Privacy model

- Village-members-only by default;
- no public indexing;
- no child names, schools, exact addresses, phone numbers, or immigration documents;
- fixed report controls;
- author can close a resolved request;
- moderators can remove unsafe or outdated content.

### Product restraint

Do not add:

- follower counts;
- likes;
- public feeds;
- popularity ranking;
- influencer profiles;
- engagement-driven infinite scrolling.

A chronological, searchable Village help board is enough.

———

## Phase 8 — Improve offline activity coordination

### Goal

Complete the path from parent connection to safe real-world activity.

### Direct playdates

Optionally allow two connected families to propose a private playdate without first creating a Village.

Support:

- title;
- date/time options;
- approximate location;
- exact address visible only after acceptance;
- adult/child attendance counts;
- accept/decline;
- reminder;
- cancellation;
- report.

### Event coordination

Add either:

- an event-specific conversation; or
- an event-filtered coordination thread inside Village chat.

Keep event messages membership-gated.

### Recurring activities

Support recurring Village activities for common cases such as:

- monthly family gathering;
- weekly language session;
- recurring game afternoon;
- regular cooking group.

Use a bounded recurrence model rather than a complex calendar engine:

- weekly;
- every two weeks;
- monthly;
- optional end date.

### Event invitations

Connect event sharing to the secure Village invitation flow rather than exposing private events publicly.

———

## Phase 9 — Complete cultural activities

### Goal

Fill the existing mission categories with meaningful, reviewed content.

Add Cameroon-linked missions for:

- traditional games;
- folktales and storytelling;
- history;
- geography;
- music and dance;
- cultural celebrations;
- family values and customs;
- language practice;
- recipes and food history;
- grandparents and family heritage.

Each mission should include:

- cultural context;
- age range;
- time estimate;
- materials;
- guardian guidance;
- steps;
- respectful attribution;
- a Passport reflection prompt.

Avoid presenting Cameroon as culturally uniform. Where possible, distinguish country-level material from Bamiléké, Bassa, Beti, Duala, and other cultural contexts.

———

## Phase 10 — Complete Roots Passport

### Goal

Turn the existing Passport foundation into a complete memory-preservation feature.

### Media access

Add authorized routes and UI for:

- viewing photos;
- playing audio;
- playing video;
- downloading documents;
- replacing media;
- deleting media;
- signed, short-lived access URLs.

### Entry metadata

Expose optional selectors for:

- culture;
- language;
- completed mission;
- event;
- Village;
- visibility.

### Sharing

Implement the existing visibility model in the UI:

- guardian-private;
- family;
- selected Village.

Do not expose the child’s general profile merely because one entry is shared.

### Export completion

Build the missing Passport export worker:

- claim queued export;
- generate a family-readable archive;
- include timeline metadata;
- include authorized media or a clearly documented media manifest;
- store in a private bucket;
- provide expiring download;
- notify the requester;
- expire and delete the export.

### Data management

Add:

- export status;
- retry after failure;
- entry edit;
- media deletion confirmation;
- audit trail for sharing changes.

———

## Phase 11 — Clarify and harden Roots Stories

### Goal

Make the premium Story workflow understandable and operationally reliable.

- Hide or explain Story creation when the family lacks entitlement.
- Do not let a free family create a request that later fails at AI-job insertion.
- Check AI/provider readiness before offering the complete workflow.
- Decide whether ai_story_adaptation is a real feature flag:
  - enforce it consistently; or
  - remove it.

- Provide clear processing, failed, retry, and provider-unavailable states.
- Support guardian editing of transcripts and child-friendly adaptations before approval.
- Make translation-language availability explicit.
- Add worker health and stuck-job monitoring.
- Keep original audio and generated text private.

Roots Stories should remain an enhancement; core community discovery must stay usable without payment.

———

## Phase 12 — Notifications and communication reliability

### Goal

Ensure important community activity reaches mobile users without exposing private data.

Add or complete notifications for:

- referral accepted;
- Village invitation;
- Village join request;
- Village join decision;
- new compatible family nearby;
- event invitation;
- event update/cancellation;
- RSVP/waitlist promotion;
- direct playdate proposal;
- support-question response;
- report resolution where appropriate;
- Passport export ready;
- Story ready or failed.

Requirements:

- localized copy;
- no message body, exact address, child name, or transcript in push/email;
- same-origin links;
- mute and preference controls;
- deduplication;
- retry handling;
- email/push controlled by actual feature flags and consent.

———

## Phase 13 — Mobile onboarding and acquisition polish

### Goal

Make the first experience suitable for users arriving from a WhatsApp link.

- Open referral context directly after signup.
- Reduce the 11-step onboarding burden where possible.
- Save progress safely.
- Improve mobile keyboard and input behavior.
- Localize every onboarding step.
- Explain approximate location and privacy concisely.
- Make cultural origin selection easier to understand.
- Allow multiple languages and availability slots without overwhelming users.
- Provide an immediate next action after onboarding:
  - view nearby families;
  - accept invitation;
  - join Village;
  - create a Village;
  - invite another family.

- Test Android Chrome, iOS Safari, and installed PWA flows.

———

## Phase 14 — Data migration and legacy cleanup

### Goal

Retire pilot blockers safely without losing legitimate user data.

- Disable admission triggers before removing UI dependencies.
- Archive or migrate pilot_waitlist entries.
- Notify existing waitlisted users that all German cities are now open.
- Convert waiting users into ordinary accounts/onboarding invitations where possible.
- Remove obsolete pilot-region write controls.
- Rename regional density concepts so administrators do not confuse them with access controls.
- Retain only privacy-necessary historical metrics.
- Update documentation, policies, README, changelog, tests, and operational runbooks.

Do not immediately drop historical tables until export, retention, and rollback requirements are reviewed.

———

## Phase 15 — Release qualification

Before rollout, verify:

### Functional

- signup from arbitrary German towns;
- onboarding in German, French, and English;
- location changes;
- culture and child-age discovery;
- connection and messaging;
- external invitation through registration;
- Village creation and membership;
- event RSVP/address rules;
- support questions;
- Passport media and export.

### Security

- RLS and IDOR tests for every new table/RPC;
- invitation-token expiry and revocation;
- block enforcement;
- event-report authorization;
- child-data projection tests;
- signed media URLs;
- upload validation;
- notification data minimization;
- rate limits;
- account deletion and retention.

### Product acceptance scenario

Use the original scenario as an end-to-end release test:

A mother in Schrobenhausen registers
→ selects Cameroonian roots
→ adds her children
→ sets a real Schrobenhausen location
→ finds or invites families around Ingolstadt/Aresing
→ finds similar child ages
→ creates “Cameroonian Families · Ingolstadt Region”
→ organizes a picnic
→ discusses Kita or school questions
→ completes a cultural activity
→ saves it in her child’s Roots Passport

This scenario should pass without an administrator opening a city, changing a region status, or overriding a family cap.

## Recommended delivery order

The practical sequence is:

1. Remove all Germany city admission blockers.
2. Complete family/profile editing and multilingual onboarding.
3. Add WhatsApp referrals and Village invitations.
4. Add density alerts and improved empty states.
5. Strengthen verification, meeting safety, and event reporting.
6. Add structured Village mutual support.
7. Improve event/playdate coordination.
8. Expand cultural missions.
9. Complete Roots media and exports.
10. Harden Stories and notification coverage.
11. Perform legacy cleanup and full release qualification.

This plan covers all genuine modifications and incomplete capabilities identified in the audit while avoiding unrelated social-network features.
