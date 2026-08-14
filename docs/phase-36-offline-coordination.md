# Phase 36 — Safe offline activity coordination

Phase 36 implements the implementation plan's Phase 8 path from a trusted parent connection to a private real-world activity.

## Private playdates

Accepted, unblocked family connections can propose a private playdate with a title, one to three future time options, an approximate area, an exact address, and adult/child attendance. The recipient chooses a time and provides its attendance when accepting, or can decline. Either family can cancel an active proposal, send a rate-limited reminder after acceptance, or report the other family through the existing safety triage.

The exact address lives only in `kinavela_private.playdate_locations`. Caller-bound RPCs return it only while the playdate is accepted. A connection becoming unavailable or blocked also removes RPC access. Tables use forced RLS and remain RPC-only.

## Event coordination and recurrence

Every private Village event has a members-only coordination thread. Messages are stored separately from general Village chat and can be read or written only while the caller's family is an active member of that event's Village. There is no public projection.

Organizers can create weekly, fortnightly, or monthly activities with an end date. Creation materializes concrete occurrences, capped at 52 and one year. Each occurrence keeps the existing RSVP, capacity, address-visibility, reminder, report, cancellation, and secure Village invitation behavior. Existing single-event clients remain compatible through the original RPC signature.

## Privacy lifecycle and operations

Playdate reminders are dispatched by the existing event-reminder cron and retained for 90 days. Personal-data exports include a family's private playdates and a profile's authored event coordination messages. Account deletion cancels playdates proposed by that profile, removes the stored address, clears reminders, and tombstones authored event messages.

Apply migrations `202608130012` through `202608130015`. Then run `npm run db:test`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run security:scan`, and `npm run build`.

Database assertion `0031_offline_activity_coordination.sql` verifies forced RLS/RPC-only access, pre-acceptance address hiding, post-acceptance disclosure, member-gated event messages, non-member denial, and bounded recurring occurrences.
