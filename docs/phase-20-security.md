# Phase 20 — Security hardening

## Audit result

- All public application tables observed in the remote catalog have RLS and forced RLS enabled.
- All remote storage buckets are private. `roots-media` and `story-audio` expose only the intended authenticated policies; `privacy-exports` has no public policy.
- Mutating application routes use same-origin protection or an explicit signed webhook/cron secret. Stripe webhooks verify the raw body before parsing.
- Auth endpoints use database-backed rate limits. Messaging, reports, story links, geocoding and village actions have server-side limits.
- Admin pages and admin RPCs both enforce active admin/moderator authorization.
- Signed story audio URLs expire after 5 minutes; privacy export URLs expire after 10 minutes and the export file after 7 days.
- `npm audit --omit=dev` reported zero vulnerabilities. The repository secret scan found only documented test/example `whsec_` values and schema validation strings; production secret files remain excluded from source control review.

## Changes in this phase

The proxy now emits a per-request CSP with a nonce and explicit Supabase origins. Response headers add HSTS, cross-origin resource isolation, download-policy protection and a capability policy that allows only same-origin microphone/geolocation features required by the product.

Uploads now require both an allow-listed MIME type/size and matching file signatures. This is an anti-spoofing control, not a malware verdict. Production operations must still add an antivirus/CDR quarantine processor before allowing unknown or executable document workflows; SVG and archive uploads remain unsupported.

## Adversarial cases covered

The database test suite verifies forced RLS and denies direct export-table access. Every user-facing RPC must re-check the authenticated profile/family/village relationship, so changing a URL UUID is not an authorization grant. Anonymous visitors receive only explicitly public aggregate data. Storage objects are never public and signed URLs are short-lived.

## Residual operational controls

Run dependency and secret scans in CI, keep the Supabase service role key server-only, rotate cron/webhook secrets, and monitor rejected uploads/rate limits. Schedule the privacy cron and review CSP reports after deployment. A malware scanner and incident-response runbook are launch prerequisites for accepting richer document formats.
