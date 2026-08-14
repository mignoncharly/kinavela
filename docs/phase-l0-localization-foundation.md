# Localization Phase L0 — foundation

Completed on 13 August 2026.

## Scope delivered

- Created a single inventory of every known customer- and operator-facing text
  surface, including web UI, accessibility, legal content, database content,
  email, push, sharing, PWA, metadata, exports, and error handling.
- Added the L0 localization contract, ownership procedure, guarded-source list,
  reference-data design, mission-content design, error/communication boundary,
  and explicit locale-formatting rule.
- Added explicit German, French, and UK-English formatting helpers for dates,
  date-times, times, numbers, currencies, lists, and relative time.
- Added a reusable translation-coverage utility that detects missing, unexpected,
  and blank leaves in nested typed copy maps.
- Registered all current typed product-copy sources: landing and application
  dictionaries; authentication and notification emails; discovery activation;
  invitations; missions; playdates; event coordination; Roots Passport; Roots
  Stories; trust and safety; and Village support.
- Extracted auth and notification email copy into typed translation sources so
  the coverage registry can validate them without importing server-only email
  delivery modules.
- Added `npm run i18n:check` to the standard `npm run check` command. It
  blocks incomplete landing dictionaries and self-tests the static-literal
  detector.
- Added `npm run i18n:report`, a non-blocking report of static JSX
  user-facing literals in `app/` and `components/`. It excludes only approved
  Kinavela/Roots product marks and reports the remaining localization debt.

## Evidence

Passed locally:

```text
npm run i18n:check
npm test -- tests/unit/localization-foundation.test.ts tests/unit/i18n.test.ts tests/unit/i18n-application.test.tsx tests/unit/invitations.test.ts tests/unit/discovery-activation.test.ts tests/unit/notification-dispatcher.test.ts
npm run typecheck
npm run lint
npx prettier --check <L0 changed files>
```

The focused unit run passed 6 files and 33 tests. The literal-copy report
currently identifies 203 non-brand static findings. Those findings are expected
and documented in the inventory; they are addressed in L1–L5 before L6 promotes
the report to a release blocker.

## Deferred work

- L1 translates and legally reviews all legal, safety, consent, and
  account-suspension content.
- L2 introduces reviewed locale-aware database content for cultural missions and
  reference data.
- L3 removes public-site, metadata, accessibility, manifest, and PWA fallback
  literals.
- L4 removes authenticated and operator UI literals and replaces
  browser-default formatting.
- L5 makes communications, downloads, and error mapping exhaustive.
- L6 makes full rendered-content coverage release-blocking.

## No migration or deployment

L0 introduces application and test infrastructure only. It has no database
migration and was not deployed as part of this phase.
