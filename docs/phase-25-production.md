# Phase 25 — Production operations and release qualification

Phase 25 closes the repeatability gaps around release validation and production monitoring.

## Delivered

- CI now validates the production environment contract, scans tracked files for high-confidence secret material, and runs the production dependency audit.
- `scripts/smoke-production.mjs` checks the health and readiness contracts, no-store behavior, required security headers and CSP safety without exposing response bodies or secrets.
- Environment validation now checks public URLs, PostgreSQL URL format, SMTP port/mode/email values and HTTPS for production app URLs.
- The Phase 11 runbook now describes the deployed privacy export worker rather than a future worker.

## Release qualification

```bash
npm ci
npm run env:check
npm run security:scan
npm audit --omit=dev --audit-level=high
npm run check
npm run db:migrate
npm run db:test
npm run build
SMOKE_BASE_URL=https://kinavela.gestionatech.de npm run smoke:production
```

The smoke check is read-only. It must run after the service restart and through the intended public HTTPS endpoint. A failed readiness check blocks release promotion.

The production database migration and assertion commands are intentionally explicit because they can change or inspect remote state. Never put production credentials in CI logs or client-prefixed variables.
