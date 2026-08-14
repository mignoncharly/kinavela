# Phase 32 — WhatsApp-friendly invitations and referrals

## Implemented flows

Kinavela now supports three deliberately narrow sharing paths:

- a family referral from Settings;
- an external Village invitation created by a Village owner, organizer or
  moderator;
- an event-associated Village invitation plus a separate internal event deep
  link for existing Village members.

Each share surface provides WhatsApp, native Web Share, copy-link and email
actions with complete German, French and English copy. Public invitation pages
are excluded from search indexing.

## Registration and acceptance

An unregistered recipient can open an invitation, register, confirm their
email and complete family onboarding without losing the invitation token.
Existing users can sign in with the same preserved context. Village membership
is created only after an onboarded family owner explicitly accepts the link.

Acceptance reuses the Village activation transaction and therefore checks:

- the smaller of the family discovery radius and Village radius;
- active Village status and member capacity;
- blocks in either direction against active Village members;
- responsible-family-owner authorization;
- existing membership;
- scheduled status and Village ownership for an associated event.

## Privacy and token handling

Invitation tokens are 256-bit random base64url values. Only their SHA-256
digests are persisted. The raw token is returned once at creation and can be
revoked by its creator. Referral links expire after 90 days and Village links
after 30 days.

Anonymous public lookup returns only invitation kind and locale, Village name
and city, optional cultural country focus, optional event title/start time and
expiry. It never returns creator/family identity, children, email, phone,
coordinates, event descriptions or exact addresses. Attribution stores only
internal profile/family identifiers, the link identifier, outcome and time.
Invitation tables use forced RLS and remain RPC-only.

## Database changes

- `202608130004_invitation_links.sql` creates the link/claim tables and guarded
  creation, lookup, revocation, attribution and acceptance RPCs.
- `202608130005_invitation_acceptance_conflict.sql` provides the forward-safe
  acceptance definition used by already-migrated environments.

## Verification

`tests/unit/invitations.test.ts` covers token shape, valid target combinations,
strict public projections and translation parity.
`tests/unit/invitations-api.test.ts` covers guarded RPC routing and safe errors.
`supabase/tests/0027_invitation_links.sql` transactionally verifies forced RLS,
least privilege, token secrecy, anonymous minimization, moderator access,
owner-only acceptance, geography, blocks, capacity, membership activation,
conversation participation, referral attribution, revocation and expiry.
