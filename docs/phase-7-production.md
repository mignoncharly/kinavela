# Phase 7 production qualification

Phase 7 adds private family-level Villages. Event creation/RSVP and cultural-content creation remain reserved for later phases; their Village tabs are scoped read-only empty states in this release.

## Membership and governance

- Active family owners create Villages, submit join requests, accept invitations, and leave for their family.
- Invitations target only mutually connected families. Listed-Village requests require internal approximate-radius eligibility.
- Activation locks the Village, enforces its configured family limit, and rejects a family blocked by any active member.
- Each Village has one active owner. Only the owner assigns roles or transfers ownership; the owner must transfer before leaving.
- Organizers and moderators can decide join requests and remove ordinary members. They cannot change roles, remove privileged members, or promote themselves.
- Removal and departure delete conversation-participant state and immediately revoke every Village RPC/RLS read.

## Privacy, chat, and moderation

Village discovery never returns `center_location`; it exposes only a safe city-level card. Member projections contain family name, city, role, and join time—never contacts, guardians, children, authentication identifiers, or exact location.

Village chat uses the existing `messages` Realtime publication with a filtered conversation subscription. Insert guards branch on conversation type and enforce live family/Village membership plus the existing 30/minute and 500/day profile limits. Members can mute chat and report a Village or another family's message. Moderators can dismiss reports, remove a reported message, or remove an eligible member. Removed messages are tombstoned and excluded by RLS while preserving moderation evidence.

## Qualification commands

```bash
cd /home/mignon/apps/kinavela
npm run db:migrate
npm run db:test
npm run check
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3021 npm run test:e2e
```

After the gates pass, restart only `kinavela.service`. Verify health/readiness, unauthenticated Village redirects, creation and governance with three real test families, live chat delivery, and immediate access loss after removal. Do not create fake production families for deployment verification.
