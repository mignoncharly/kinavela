# Phase 31 — Complete multilingual application support

## Supported locales

Kinavela provides German (`de`), French (`fr`) and English (`en`) from
registration through onboarding and the authenticated family workflow. The
locale remains encoded in public and authenticated routes, is included in
authentication and onboarding requests, and is stored as
`profiles.preferred_language`. Changing the interface language in Settings
saves the preference and moves the browser to the matching localized route.

## Localized application surfaces

`lib/i18n/app-copy.ts` contains the parity-checked daily-use dictionaries for:

- authentication framing and legal links;
- onboarding, validation feedback and Germany-wide discovery copy;
- the family dashboard and complete family-profile editor;
- preservation goals, availability labels and matching priorities;
- privacy controls and account deletion;
- notification preferences and notification-feed labels;
- billing status, pricing actions, dates and errors;
- PWA installation, offline snapshots and save-offline actions.

Interest records are rendered through their persisted `name_key` values. Raw
database slugs are no longer used as onboarding or Settings labels. Cultural
language choices remain independent from the interface language.

## Verification

`tests/unit/i18n-application.test.tsx` recursively compares all German, French
and English dictionary leaf paths, rejects empty translations and renders the
registration and onboarding surfaces for each locale. Existing landing-page
dictionary coverage remains in `tests/unit/i18n.test.ts`.

Release checks include formatting, ESLint, TypeScript, all unit/API tests and a
production build. This phase contains no database migration.
