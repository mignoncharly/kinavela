# Kinavela

Kinavela is the production foundation for a privacy-first platform that helps diaspora families build trusted local communities and preserve cultural memories for their children.

This repository currently implements **Phase 0 only**, as required by the product blueprint: a secure Next.js foundation, multilingual public landing page, health/readiness endpoints, isolated deployment assets, Supabase connectivity, testing, CI, and operational documentation. Authentication and product-domain phases intentionally remain future work.

## Local development

1. Copy `.env.example` to `.env.local` and add non-production development credentials.
2. Install with `npm ci`.
3. Run `npm run dev`.
4. Validate with `npm run check`.

Production secrets live only in the untracked `.env.production`; do not copy them into source, issues, logs, or client-prefixed variables.

See [docs/deployment.md](docs/deployment.md), [docs/architecture.md](docs/architecture.md), and [docs/security.md](docs/security.md).
