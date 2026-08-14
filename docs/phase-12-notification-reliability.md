# Phase 12 — Notification and communication reliability

Phase 12 routes important community activity through one privacy-filtered,
deduplicated notification outbox for in-app, email, and Web Push delivery.

## Coverage

Notifications now cover referral acceptance, Village invitations and membership
decisions, compatible-family availability, event invitations and changes,
RSVP/waitlist activity, playdate proposals, support responses, appropriate report
resolutions, Passport exports, and successful or failed Story processing. Existing
connection, message, Village activity, and reminder notifications remain intact.

## Privacy and control

- Push and email use generic localized German, French, or English copy.
- The database rejects notification payloads containing message bodies, exact
  addresses, child names, transcripts, adaptations, or audio paths.
- Application destinations are generated from a closed same-origin route map;
  payload-provided URLs are never followed.
- Families can enable or mute community, event, direct communication, heritage,
  and safety categories independently.
- Existing conversation/Village mutes suppress Village activity and support
  notifications.
- Email requires both the email preference and active product-email consent.
  Email and push also remain controlled by their rollout feature flags.

## Delivery reliability

- The existing unique outbox key deduplicates recipient, channel, kind, and entity.
- Claims now carry a dedicated lease timestamp, so old queued rows are not mistaken
  for stuck workers.
- Transient provider failures return to the queue with bounded exponential delay.
- Five unsuccessful attempts produce a terminal failure.
- Push tags include the delivery identifier so distinct events of the same kind do
  not overwrite each other on mobile devices.

Migrations `202608130020_notification_communication_reliability.sql` through
`202608130022_notification_claim_consent.sql` implement the database contract.
Database assertions in `0035_notification_communication_reliability.sql` verify
privacy filtering, preferences, worker leases, retry behavior, trigger coverage,
mute enforcement, and least-privilege grants.
