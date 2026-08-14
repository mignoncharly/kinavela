# Architecture

Kinavela is a Next.js App Router application running as a dedicated Node.js process on loopback port 3020. Nginx terminates TLS and proxies only the Kinavela hostname to that port. Supabase provides managed PostgreSQL/Auth/Storage. Phases 0–23 cover the foundation, identity, onboarding, location/discovery, deterministic matching, family connections and messaging, private Villages and events, Roots missions and stories, AI jobs, notifications, moderation, billing, SEO, GDPR controls, PWA support, security hardening, and Germany-wide geocoded family access.

Public pages use Server Components and static generation. Interactive browser code receives only the Supabase project URL and publishable key. Server-only modules are guarded with `server-only`. Environment validation fails startup when required production configuration is missing.

Location search is a server-only adapter in `lib/geo`. Browser clients submit only validated city/postcode searches; the adapter can be switched with `GEOCODING_BASE_URL`, enforces application and provider limits, caches place centres, and returns an opaque place ID. The database resolves that ID inside authorization-aware RPCs. Discovery reads cross-family data only through `discover_families`; direct family/child RLS remains private.

Phase 4 matching remains database-owned so distance and permission filtering cannot diverge from scoring. `match_families` is the authenticated projection; its private scorer is unavailable to API roles. `features/matching` validates the returned contract before rendering. Ranking contains no AI or client-side score calculation.

Phase 5 uses one canonical `family_connections` row per unordered family pair. Authenticated RPCs derive the acting family from `auth.uid()` and enforce the requested → accepted/declined/blocked state machine. Pending projections reuse discovery-safe fields; accepted projections additionally expose only the family bio and active guardian display names. `notifications` stores typed references rather than user-authored message bodies. The private `families_are_connected` helper is the single authorization seam that Phase 6 communication must call.

Phase 6 creates one `family` conversation per accepted connection and records profile/family participants separately. All writes use authenticated RPCs; direct table access is read-only and RLS rechecks the live accepted-connection predicate for every conversation and message row. `messages` is in the `supabase_realtime` publication, and clients subscribe only to inserts filtered by conversation UUID. The event triggers a server-data refresh, so sender display names continue to come from the authorized projection rather than denormalized realtime payloads.

Phase 7 adds location-backed Village discovery without returning Village center coordinates. Family owners create, request, accept invitations, and leave on behalf of a family. One active owner is enforced per Village; only that owner assigns roles or transfers ownership. Organizers and moderators can process requests and remove ordinary members, but cannot promote themselves or alter ownership. Village chat reuses the shared message table and Realtime channel while its RLS path checks live Village membership.

Phase 30 centralizes post-onboarding family mutations in an owner-only database RPC. Children remain family resources, direct profile-table writes are revoked, and location changes continue through the opaque geocoder-place RPC so profile display city and PostGIS geography cannot diverge.

Phase 31 localizes daily-use application copy in German, French and English. Structural parity tests cover application and landing dictionaries. Interest labels resolve through database `name_key` values, while cultural family languages remain independent from the selected interface language.

Phase 35 adds a bounded support board inside each private Village. Posts and replies are accessed only through membership-checking RPCs over forced-RLS, grant-free tables. Full-text search uses PostgreSQL's simple-language vector so German, French, English, and family cultural terms share one deterministic index. Reports extend the existing moderation queue instead of creating a separate safety system, while notifications carry only typed identifiers.

Phase 9 of the new implementation plan versions cultural mission content and
makes editorial review a database-enforced publication boundary. Versioned
catalogue RPCs project cultural scope, materials, guardian guidance,
attribution and Passport reflection prompts only for active, reviewed
missions. Mission progress and Village assignment authorization remain
unchanged.

Phase 10 of the new implementation plan completes Roots Passport management.
Caller-bound RPCs validate optional cultural and community metadata, record
sharing transitions, and authorize private media paths. The existing privacy
worker claims Passport export jobs and stores short-lived JSON timeline
archives in a separate private bucket with a path-free media manifest.

The application is structured around `app/`, `components/`, `features/`, `lib/`, `supabase/`, `tests/`, `deploy/`, and `docs/`. New domains must be implemented one blueprint phase at a time.

## Phase 8 events

Phase 8 keeps event state in PostgreSQL behind authenticated RPCs. Organizer permissions reuse live Village membership with an owner/organizer-only helper. Capacity changes lock the event row and promote the oldest waitlisted family deterministically. Exact addresses are stored in the private schema and conditionally projected only after an authorization check. Typed reminder deliveries are dispatched by a loopback systemd timer through a service-role-only routine; the browser never receives the timer secret or service key.

## Phase 9 Village discovery engine

Phase 9 detects local origin-country clusters inside a private database helper. Detection requires seven mutually discoverable families within 30 km, child ages compatible within three years across at least three broad age bands, and no active Village with the same country focus within 30 km. The authenticated projection is owner-only and returns only country name, requester city, aggregate count, age bands, and fixed radius—never candidate IDs, profiles, or coordinates.

Recommendation reads are stable and side-effect free. Starting or dismissing requires a same-origin authenticated POST and a family-owner RPC. Starts are serialized per country, re-run detection inside the transaction, and then use the ordinary Village creation path; this prevents simultaneous recommendations from creating duplicate nearby Villages.

## Stripe billing

Billing is family-owned. A family owner uses server-validated Stripe-hosted Checkout and the Stripe Customer Portal; authorized guardians inherit the family entitlement but cannot manage billing. Supabase stores the family-to-Customer mapping, synchronized subscriptions and minimized event audit records behind forced RLS. The webhook route is `/api/billing/webhook`; Stripe is the billing source of truth and the database projection is a cache for entitlement checks. Community access is not gated by billing.

The only active Roots Family entitlement is the existing Roots Stories AI workflow. AI creation is checked server-side by database entitlement triggers and remains subject to quotas and cost limits.

Phase 14 archives retired admission-waitlist rows in the private schema for a bounded 180-day rollback window. Active application analytics use product-health and regional-outreach projections with no admission state. The privacy cron removes identifiable legacy rows after the window; de-identified city totals remain subject to periodic retention review.
