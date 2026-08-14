# Localization Phase L1 — legal, safety, consent, and account state

Implemented on 13 August 2026. The required legal and child-safety review was
confirmed on 13 August 2026; retain the approved wording and reviewer evidence
with the release record.

## Scope delivered

- Replaced the single English-only legal renderer with locale-aware German,
  French, and English documents for:
  - privacy policy;
  - terms of service;
  - Impressum;
  - cookie and browser-storage policy;
  - child-safety policy; and
  - community guidelines.
- Localized legal navigation, document titles, metadata, effective-version
  framing, controller contact labels, table headers, and general contact labels.
- Added locale-specific titles, descriptions, and canonical paths for every
  legal route.
- Localized the suspended-account explanation and return action.
- Kept the existing localized privacy-metrics banner and settings controls in
  place; their German, French, and English copy remains unchanged.
- Added rendering tests for every legal document in each locale, content
  completeness checks for every locale/document combination, a French
  suspended-account test, and metadata tests.

## Automated evidence

Passed locally:

```text
npm run i18n:check
npm test -- tests/unit/legal-localization.test.tsx tests/unit/localization-foundation.test.ts tests/unit/i18n.test.ts tests/unit/i18n-application.test.tsx
npm run typecheck
npm run lint
npm run build
```

The focused localization run passed 4 files and 42 tests. The dedicated legal
suite passed 21 tests after the metadata assertions were added. The production
build generated 75 routes successfully.

## Review record

The user confirmed that the required review had been completed. The release
record must retain the qualified German/French legal and child-safety/moderation
reviewer evidence for the exact deployed wording, including verification of
processor configuration, retention periods, payment terms, supervisory-authority
details, reporting and emergency-service statements.

## Deployment status

No database migration is required. Run the normal release qualification and
public smoke checks for the German, French, and English legal routes before
deployment.
