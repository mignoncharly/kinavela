# Phase 28 — Release qualification

Phase F makes the final release gate repeatable. The qualification command
checks the environment contract, tracked-file secret scan, production
dependency audit, application checks, remote migrations, and remote database
assertions in that order.

Run it from the reviewed release tree:

    npm ci
    SMOKE_BASE_URL=https://kinavela.gestionatech.de npm run release:qualification

`SMOKE_BASE_URL` is optional for local qualification, but it must be set for
production promotion. The smoke check is read-only and verifies health,
readiness, security headers, no-store responses, and unauthenticated rejection
of both AI worker endpoints. It never sends provider credentials or AI data.

The qualification command applies only forward migrations through the existing
reviewed migration runner. Database assertions run in transactions and must
pass before a release is considered promotable.
