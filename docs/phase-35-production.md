# Phase 35 — Structured Village support

Phase 35 implements the implementation plan's Phase 7 mutual-support goal as a bounded, members-only Village help board. It is not a public social feed.

## Product behavior

Active Village families can create chronological posts, reply, search, and filter by status, type, and practical category. Supported types are questions, help requests, recommendation requests, resources, announcements, and offers of help. Categories cover Kita, school, German, administration, immigration/integration experience, healthcare navigation, family services, transport, childcare coordination, local recommendations, and other practical support.

The authoring profile can close its own open post as resolved. There are no likes, followers, popularity scores, public profiles, ranking, or infinite scrolling. A result page is capped at 30 posts; database pagination supports up to 50.

## Privacy and safety

`village_support_posts` and `village_support_replies` use forced RLS and have no authenticated table grants. Reads and writes use caller-bound RPCs that recheck active Village membership. No public route or search projection exposes board content.

Every post and reply requires an explicit confirmation that it contains no child names, schools, exact addresses, phone numbers, email addresses, or immigration documents. The database additionally rejects obvious email addresses and German/international phone-number patterns. This is a protective layer, not a guarantee that free text contains no personal data. No file upload is available.

The interface tells families to share only general experience and use qualified services for urgent medical, legal, or official matters. Resource links may be shared, but Kinavela does not verify or endorse their professional advice.

Notifications contain only Village, post, and activity identifiers. They never copy the title, body, reply, address, or contact information into the notification payload or audit metadata.

## Reporting and moderation

Posts and replies have fixed report reasons: privacy exposure, unsafe advice, harassment, discrimination, fraud, child-safety concern, outdated/misleading, and other. Reports use the existing five-per-day limit, severity triage, response targets, Village escalation, global admin queue, and action history.

Village owners, organizers, and moderators can tombstone unsafe, privacy-violating, duplicate, or outdated content directly or from a report. Urgent child-safety reports cannot be dismissed at Village level. Global moderators can remove reported support content and document the decision without copying the reported text into notes.

## Notifications and privacy lifecycle

New posts notify active Village profiles using the existing `village_activity` channel. Replies notify the original author. In-app notifications deep-link to the private Support tab; optional email and push remain subject to the existing notification preferences and rollout controls.

Authored posts and replies are included in personal-data exports. When a profile reaches deleted status, a database trigger tombstones and replaces its authored support text. Normal active content otherwise follows the account lifecycle; moderation references retain minimized safety metadata according to the existing retention policy.

## Deployment and verification

Apply:

- `202608130010_village_support_board.sql`
- `202608130011_village_support_privacy_lifecycle.sql`

Then run `npm run db:test`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run security:scan`, and `npm run build`.

Database assertion `0030_village_support_board.sql` verifies forced RLS, RPC-only access, privacy acknowledgement and contact-detail rejection, search, replies, author resolution, fixed reporting, critical child-safety triage, Village/global moderation projections, tombstones, minimized notifications/audits, and GDPR export coverage.
