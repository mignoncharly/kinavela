# Phase 13: mobile onboarding and acquisition polish

Phase 13 shortens family onboarding, preserves invitation intent, and makes the first mobile session resumable and actionable.

## Delivered

- Seven localized stages replace the previous eleven-screen sequence.
- German, English, and French copy covers every new control and privacy explanation.
- Authenticated drafts are stored in the private database schema for 30 days and are never exposed through direct table grants.
- Draft payloads are schema-checked, limited to 32 KiB, and exclude invitation tokens and authentication data.
- Multiple family languages and up to seven practical availability slots can be added without crowding the initial view.
- Duplicate language and availability combinations are rejected.
- Village and family-referral context remains visible during onboarding, then returns the family directly to invitation acceptance.
- Approximate city matching is explained before consent; exact addresses are neither requested nor exposed.
- Mobile inputs use appropriate autocomplete, search, numeric keyboards, 16 px controls, touch targets, sticky actions, and safe-area padding.
- The completed-family dashboard offers immediate actions for nearby families, Villages, Village creation, and family invitations.
- Authenticated responsive coverage includes 390 x 844 iOS Safari and 412 x 915 Android Chrome target sizes. Existing manifest, service-worker, and offline tests cover installed PWA behavior.

## Data lifecycle and security

Migration `202608130023_mobile_onboarding_drafts.sql` creates `kinavela_private.onboarding_drafts`. Only three authenticated security-definer functions may read, upsert, or delete the current profile's draft. Completion deletes the draft, profile deletion cascades it, and reads ignore drafts older than 30 days.

## Verification

Run:

```bash
npm run typecheck
npm run lint
npm test
npm run security:scan
npm run build
npm run db:test
```
