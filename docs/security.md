# Security

- Service-role, database, and SMTP credentials are server-only and never use `NEXT_PUBLIC_`.
- `.env*`, the supplied credential inventory, keys, and certificates are ignored by Git.
- Production runs as the unprivileged `mignon` account with systemd hardening and a read-only filesystem except for the Next cache and dedicated logs.
- Port 3020 binds to `127.0.0.1`; only Nginx is Internet-facing.
- TLS, HSTS, frame denial, content-type protection, referrer policy, permissions policy, and a restrictive CSP are applied at Nginx.
- Health responses contain no credentials or exception details.
- Sentry PII transmission is disabled and remains inactive until a DSN is explicitly configured.

Before later phases launch, perform the blueprint's RLS, IDOR, upload, CSRF, XSS, rate-limit, signed-URL, admin-authorization, and secret-scanning gates.

- Phase 3 geocoding is authenticated, input-bounded, per-client rate-limited, globally limited to one upstream request per second, and cached for 30 days. Provider access is server-only and replaceable.
- Cross-family discovery is available only through a security-definer function that derives the requester from `auth.uid()`, applies bidirectional blocks, and projects an explicit privacy-safe result shape.
- Supabase-managed routine defaults may grant API roles directly. Migration `202608090004_phase3_rpc_grants.sql` revokes every Phase 3 RPC from all API roles before granting only its intended role; database tests assert the effective privileges.
- Phase 4's public matching RPC derives its requester from the authenticated session and cannot be used to score arbitrary family IDs. Both private scorer signatures explicitly deny API-role execution. Fixed-fixture tests assert grants, bounded scores, filters, block inheritance, stable ordering, and absence of sensitive return fields.
- Phase 5 connection writes are RPC-only and owner-authorized. Requests are limited to ten per family in 24 hours, targets must be mutually discoverable and within both radii, and declined pairs have a 30-day cooldown. A canonical pair index and transaction advisory lock prevent duplicate or crossed request rows.
- Only the pending recipient can accept or decline. A block supersedes every connection status. Connection and notification tables use forced RLS; API roles cannot insert or update them directly, and private eligibility/connection helpers deny API-role execution.
- The accepted projection is an allowlist containing family bio and guardian display names, with database and TypeScript contract tests rejecting sensitive fields. Phase 6 communication must call the private accepted-connection predicate before allowing any message operation.
- Phase 6 creates conversations only for accepted, unblocked family pairs. Message reads, RPC writes, unread calculations, Realtime delivery, mute changes, and read changes all recheck authenticated family membership and the live connection predicate.
- Message bodies are trimmed, plain text, and limited to 2,000 characters. Sending is limited to 30 messages per minute and 500 per day per profile. API roles have no direct insert/update/delete grants on conversations, participants, messages, or reports.
- Reports accept only fixed target types and reason codes, are limited to five per profile per day, and remain readable only by the reporter (plus privileged database/moderation infrastructure). Message content is excluded from audit metadata.
- Postgres Changes is filtered by conversation ID and authorized through message SELECT RLS. The browser receives only the publishable key; the service role is never used by Realtime clients.
- Phase 7 Village creation, invitations, join decisions, roles, removal, leaving, chat, and moderation are authenticated RPC-only operations. Family owners act for their family; ordinary Village members cannot promote themselves or process membership requests.
- One partial unique index enforces a single active Village owner. Owners must transfer ownership before leaving. Activation locks the Village row, enforces its family limit, and rechecks bidirectional family blocks against every active member.
- Village centers remain internal geography values. Discovery and member projections exclude coordinates, authentication IDs, contacts, guardians, and children. Active membership is rechecked for every Village page/message read and message insert.
- Moderated messages use `deleted_at` tombstones. Message RLS excludes tombstones, while the referenced report and content remain available only to privileged moderation infrastructure for later review.
- Structured Village support posts and replies are forced-RLS and RPC-only. Mutations derive the author from the session, enforce per-profile rate limits and active membership, require privacy confirmation, and reject obvious email/phone disclosure. Search and DTOs expose no profile IDs or contact fields.
- Support reports use fixed reasons and the existing report-rate, triage, escalation and action-history controls. Tombstoned text is excluded from member projections; notifications and audit events never duplicate support bodies or titles.

## Phase 8 event security

- Event managers are active Village owners or organizers; moderators and members cannot create, edit, cancel, remind, or confirm attendance.
- Exact addresses have no API table grants and are returned only by the conditional security-definer projection.
- Capacity and waitlist transitions lock the event row. Creation and organizer reminders have database-owned rate limits.
- The reminder dispatcher is service-role-only. Its loopback route requires a 32-character minimum server-only secret and uses constant-time comparison.

## Billing security

Stripe secrets are server-only and production environment files remain mode 0600. Checkout accepts only the application plan names `monthly` and `annual`; the server maps them to configured Price IDs and never trusts client amounts, currencies, customer IDs or entitlement flags. Billing ownership is derived from the authenticated profile active family-owner membership, so changing an ID in a request cannot open another family billing Portal.

The webhook reads the raw request body, verifies Stripe signature and rejects unsigned or stale payloads. Only the six selected subscription, checkout and invoice event types are acted on. Minimized event metadata is recorded with idempotent processing states, and failed processing returns a retryable response. Billing tables have forced RLS, no authenticated table grants and service-role-only synchronization.
