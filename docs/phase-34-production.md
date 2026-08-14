# Phase 34 — Trust and child-meeting safety

## Verification means exactly what it says

Settings now contains a Trust Center with three adult-profile facts:

- email confirmation means Supabase Auth confirmed control of the email
  address;
- optional phone confirmation means Supabase Auth confirmed control of the
  phone number;
- community verification means either an established, already
  community-verified Village moderator endorsed the adult profile in that
  Village context, or Kinavela staff reviewed and approved the request.

None of these facts means that Kinavela has declared someone safe. Phone
numbers, email addresses and auth identifiers are not returned by the trust
status RPC. Identity verification remains intentionally unimplemented until a
separate reviewed provider and policy are approved.

Phone confirmation uses Supabase Auth's phone-change OTP flow. Before presenting
it as available in production, configure and test an approved SMS provider,
sender, rate limits, anti-abuse controls and German/EU privacy terms in the
Supabase Auth project. If the provider is unavailable, the UI fails closed and
does not mark the phone as confirmed.

## Community verification workflow

An adult can request review only through a Village in which their family is an
active member. A Village endorsement requires:

- a moderator, organizer or owner from a different family;
- an active community-verification record for that reviewing adult;
- a pending request in the same Village.

This creates a controlled progression: staff review can establish the first
reviewers, while established reviewers can later endorse other adult profiles.
Staff decisions require a note. The database records the exact method and
statement and keeps the tables forced-RLS and RPC-only.

## First offline action

Before a profile's first firm event RSVP or recorded in-person connection
meeting, the UI presents concise guidance to:

- meet publicly at first;
- avoid sharing a child's school or direct contact details;
- keep guardian supervision;
- control exact-address sharing;
- use block/report when uncomfortable;
- contact emergency services for immediate danger.

The acknowledgement is versioned and enforced by the event and meeting RPCs,
not only by the UI. It is guidance and does not transfer guardian responsibility
to Kinavela.

## Event reporting and moderation

Every non-organizer Village member can report an event for unsafe location,
inappropriate conduct, misleading information, child-safety concern,
discrimination, fraud or another concern. Event access is re-authorized in the
database, and organizers cannot report their own event through this path.

Reports are automatically classified:

- critical child safety: internal response target within one hour;
- high severity: 24 hours;
- medium severity: 72 hours;
- low severity: seven days.

These are operational targets, not guaranteed service-level agreements. Village
moderators can escalate reports and cancel or restrict a reported event. An
urgent child-safety report cannot be dismissed at Village level. Global
moderators can assign a report, add notes, change severity, restrict/cancel an
event, resolve or dismiss it. Every action has a separate history record.

Report and audit metadata do not copy private message bodies, exact addresses,
child contact details, email addresses or phone numbers. Reviewers are told not
to paste those values into notes.

## Database changes and verification

- `202608130007_trust_and_child_meeting_safety.sql` adds verification,
  acknowledgement, event-reporting and structured moderation workflows.
- `202608130008_event_report_insert_guard.sql` forward-updates the existing
  defense-in-depth report trigger to authorize event targets.
- `202608130009_report_action_history_projection.sql` gives authenticated
  global moderators an admin-checked, minimal action-history projection.
- `supabase/tests/0029_trust_and_child_meeting_safety.sql` verifies forced RLS,
  least privilege, auth verification facts, acknowledgement enforcement,
  self-endorsement denial, event target authorization, critical triage,
  Village escalation, staff history and private-address exclusion.

Run:

```bash
npm run db:migrate
npm run db:test
npm run check
npm run build
```
