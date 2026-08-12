# Architecture

Kinavela is a Next.js App Router application running as a dedicated Node.js process on loopback port 3020. Nginx terminates TLS and proxies only the Kinavela hostname to that port. Supabase provides managed PostgreSQL/Auth/Storage. Phases 0–23 cover the foundation, identity, onboarding, location/discovery, deterministic matching, family connections and messaging, private Villages and events, Roots missions and stories, AI jobs, notifications, moderation, billing, SEO, GDPR controls, PWA support, security hardening, and the Germany pilot control plane.

Public pages use Server Components and static generation. Interactive browser code receives only the Supabase project URL and publishable key. Server-only modules are guarded with `server-only`. Environment validation fails startup when required production configuration is missing.

Location search is a server-only adapter in `lib/geo`. Browser clients submit only validated city/postcode searches; the adapter can be switched with `GEOCODING_BASE_URL`, enforces application and provider limits, caches place centres, and returns an opaque place ID. The database resolves that ID inside authorization-aware RPCs. Discovery reads cross-family data only through `discover_families`; direct family/child RLS remains private.

Phase 4 matching remains database-owned so distance and permission filtering cannot diverge from scoring. `match_families` is the authenticated projection; its private scorer is unavailable to API roles. `features/matching` validates the returned contract before rendering. Ranking contains no AI or client-side score calculation.

Phase 5 uses one canonical `family_connections` row per unordered family pair. Authenticated RPCs derive the acting family from `auth.uid()` and enforce the requested → accepted/declined/blocked state machine. Pending projections reuse discovery-safe fields; accepted projections additionally expose only the family bio and active guardian display names. `notifications` stores typed references rather than user-authored message bodies. The private `families_are_connected` helper is the single authorization seam that Phase 6 communication must call.

Phase 6 creates one `family` conversation per accepted connection and records profile/family participants separately. All writes use authenticated RPCs; direct table access is read-only and RLS rechecks the live accepted-connection predicate for every conversation and message row. `messages` is in the `supabase_realtime` publication, and clients subscribe only to inserts filtered by conversation UUID. The event triggers a server-data refresh, so sender display names continue to come from the authorized projection rather than denormalized realtime payloads.

Phase 7 adds location-backed Village discovery without returning Village center coordinates. Family owners create, request, accept invitations, and leave on behalf of a family. One active owner is enforced per Village; only that owner assigns roles or transfers ownership. Organizers and moderators can process requests and remove ordinary members, but cannot promote themselves or alter ownership. Village chat reuses the shared message table and Realtime channel while its RLS path checks live Village membership.

The application is structured around `app/`, `components/`, `features/`, `lib/`, `supabase/`, `tests/`, `deploy/`, and `docs/`. New domains must be implemented one blueprint phase at a time.

## Phase 8 events

Phase 8 keeps event state in PostgreSQL behind authenticated RPCs. Organizer permissions reuse live Village membership with an owner/organizer-only helper. Capacity changes lock the event row and promote the oldest waitlisted family deterministically. Exact addresses are stored in the private schema and conditionally projected only after an authorization check. Typed reminder deliveries are dispatched by a loopback systemd timer through a service-role-only routine; the browser never receives the timer secret or service key.

## Phase 9 Village discovery engine

Phase 9 detects local origin-country clusters inside a private database helper. Detection requires seven mutually discoverable families within 30 km, child ages compatible within three years across at least three broad age bands, and no active Village with the same country focus within 30 km. The authenticated projection is owner-only and returns only country name, requester city, aggregate count, age bands, and fixed radius—never candidate IDs, profiles, or coordinates.

Recommendation reads are stable and side-effect free. Starting or dismissing requires a same-origin authenticated POST and a family-owner RPC. Starts are serialized per country, re-run detection inside the transaction, and then use the ordinary Village creation path; this prevents simultaneous recommendations from creating duplicate nearby Villages.

## Stripe billing

Billing is family-owned. A family owner uses server-validated Stripe-hosted Checkout and the Stripe Customer Portal; authorized guardians inherit the family entitlement but cannot manage billing. Supabase stores the family-to-Customer mapping, synchronized subscriptions and minimized event audit records behind forced RLS. The webhook route is `/api/billing/webhook`; Stripe is the billing source of truth and the database projection is a cache for entitlement checks. Community access is not gated by billing.

The only active Roots Family entitlement is the existing Roots Stories AI workflow. AI creation is checked server-side by database entitlement triggers and remains subject to quotas and cost limits.
