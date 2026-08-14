# Localization Phase L6 — qualification and release

## Release evidence

- Environment contract, secret scan, production dependency audit, formatting, localization checks, ESLint, TypeScript, unit tests, production build, remote database assertions, and cross-browser release qualification were run through `npm run release:qualification` on 13 August 2026.
- The application checks passed with 43 test files and 187 tests.
- The production build generated 75 routes.
- The localization report has four reviewed identity-only exclusions: Kinavela’s stylized marks, the legal company owner, and TRUST.

## Deployment

- Restarted `kinavela.service` at 22:17 UTC on 13 August 2026.
- Local `/api/health` and `/api/readiness` both returned `200` with the expected no-store and security headers.
- Public HTTPS smoke passed for `https://www.kinavela.com`.
- Deployed locale checks confirmed German, French, and English localized manifests; the French page rendered `lang="fr"`.

## Known boundary

- Machine-readable JSON exports intentionally retain stable technical field names, identifiers, ISO codes, timestamps, and enum values. User-created content is preserved as supplied.

## Correction and rollback

Application rollback: restore the prior reviewed build, rebuild, and restart only `kinavela.service`. Database migrations are forward-only and require a reviewed compensating migration.
