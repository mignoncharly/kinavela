# Phase 10 production qualification

Phase 10 adds a manually curated cultural mission catalogue. Missions have a culture association, a broad child-age range, bounded steps, family-owned progress, and optional Village assignments. Children remain non-account holders and no child identity is returned by the mission projections.

## Authorization and privacy

- Mission content is safe catalogue data; progress and Village assignment tables remain forced-RLS and RPC-only.
- Only an active family owner or guardian can start a mission or complete a step. A Village mission additionally requires active membership in that Village.
- Only an active Village owner or organizer can assign a mission. Moderators and ordinary members cannot change the mission catalogue.
- Listing returns mission content and the requesting family’s own progress only. It never returns child names, child IDs, contact details, coordinates, or family profiles.
- Completion writes `mission_completed` to the audit trail without storing child data. The completion state is the hand-off point for the Roots Passport phase.

## Qualification commands

```bash
cd /home/mignon/apps/gtech/kinavela
npm run db:migrate
npm run db:test
npm run check
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3021 npm run test:e2e
```

With reviewed test families, verify that an authenticated family can browse the curated catalogue, start one mission, complete its steps exactly once, and see completion persist. Verify that a family member without owner/guardian role cannot mutate progress, that an ordinary Village member cannot assign missions, and that a non-member cannot list or progress a Village mission. Confirm that completing a mission creates no public child profile or Roots Passport row before Phase 11.
