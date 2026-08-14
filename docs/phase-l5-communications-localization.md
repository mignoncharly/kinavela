# Localization Phase L5 — communications, errors, sharing, and exports

## Delivered

- Replaced generic notification email copy with an exhaustive German, French, and English subject/body mapping for every notification kind.
- Made email and push draw from the same localized, privacy-safe delivery source; delivery always links only to the relevant protected Kinavela route.
- Added tests that require every notification kind to have a non-empty email/push mapping in every locale and verify localized HTML and plain-text email rendering.
- Localized Web Share and clipboard failures; cancelling the native share sheet remains silent.
- Preserved personal-data and Roots Passport exports as stable machine-readable JSON. The existing localized download controls, safe attachment headers, UTF-8 JSON content type, expiring private storage, and stable identifiers remain the human/machine boundary.

## Verification

- `npm run typecheck`, `npm run lint`, `npm run i18n:check`, `npm test`, and `npm run build` pass.
- Tests: 43 files, 187 tests.
- The literal report contains only the four reviewed non-translatable identity marks.

## Deployment

No database migration is required. Deploy the application build to publish this phase.
