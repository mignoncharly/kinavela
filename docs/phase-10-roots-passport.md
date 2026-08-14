# Phase 10 — Complete Roots Passport

This phase implements Phase 10 of `new_implementation_plan.md`.

## Passport management

Guardians can create and edit timeline entries with optional culture, language,
completed mission, private Village event and Village metadata. Visibility is an
explicit choice: guardian-private, family, or one selected active Village.
Changing visibility or its selected Village creates a separate, RPC-only
sharing-history record and a minimized audit event.

The owner-facing projection includes only metadata needed to manage the
timeline. Sharing one entry never exposes a child's general profile.

## Private media

Photos, audio, video and PDF documents remain in the private `roots-media`
bucket. Authorized media routes issue five-minute signed URLs after checking
live entry visibility. Guardians can view or download, add, replace and delete
media. Replacement and entry/media deletion remove the superseded storage
object; file signatures, MIME allowlists and the 25 MB limit remain enforced.

## Passport exports

The existing privacy worker now claims queued Passport exports, produces a
family-readable JSON timeline archive and uploads it to the private
`roots-exports` bucket. The archive contains a documented media manifest with
kind, MIME type and size, but no storage paths; media stays accessible through
the ordinary authorized Passport route.

Exports expose queued, processing, ready, failed and expired states. A failed
job can be retried up to three attempts. Ready archives receive a seven-day
expiry and five-minute authorized download URL. The worker removes expired
objects and includes export objects in account-deletion cleanup. Completion
creates a privacy-minimized `passport_export_ready` notification.

## Deployment and verification

Apply `202608130017_complete_roots_passport.sql`. Then run
`npm run db:test`, `npm test`, `npm run typecheck`, `npm run lint`,
`npm run security:scan`, and `npm run build`.

Database assertion `0033_complete_roots_passport.sql` verifies forced RLS,
least privilege, metadata authorization, sharing history, worker claims,
private export payloads and minimized notifications.
