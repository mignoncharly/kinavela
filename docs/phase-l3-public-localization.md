# Phase L3 — Public website, SEO, and PWA localization

## Status

Implemented and verified locally on 13 August 2026. No database migration is
required for this phase.

## Delivered

- The landing page now takes sign-in, navigation and accessibility labels,
  illustration text, privacy emblem, CTA eyebrow, and legal footer labels from
  the German, French, and English landing dictionaries.
- Public community pages use localized city labels in their visible copy and
  metadata. German uses `München`; French uses `Allemagne` and `Francfort`.
  Their navigation, privacy link, forming state, footer, and accessibility names
  are localized.
- Invitation and public story-recording pages now generate localized,
  non-indexable metadata.
- The root layout reads the locale inserted by the proxy and emits the matching
  initial HTML `lang` value. The existing client component preserves that value
  after navigation and also recognizes `/offline?locale=…`.
- Every localized route advertises an explicit locale manifest at
  `/{de|fr|en}/manifest.webmanifest`; the response has localized description,
  language, start URL, and ID.
- The service-worker cache version is `kinavela-shell-v3`, caches all three
  localized offline pages, preserves locale on navigation fallback, and uses a
  German, French, or English fallback push body based on message locale or URL.

## Verification

- `npm run typecheck`
- `npm run lint`
- `npm run i18n:check`
- Focused unit suite: 24 tests across i18n, application-i18n, PWA, and SEO.
- Production build: 75 routes.
- Local production-server check: `/fr/manifest.webmanifest` returned `lang: fr`
  and `start_url: /fr`; `/fr` initially rendered `<html lang="fr">`.

## Remaining scope

L4 remains responsible for authenticated application and operator-interface
copy, including the public story recorder's remaining in-component defaults.
L5 covers dispatched communications and provider-error surfaces.
