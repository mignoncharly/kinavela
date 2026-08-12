# Kinavela

Kinavela is the production foundation for a privacy-first platform that helps diaspora families build trusted local communities and preserve cultural memories for their children.

This repository implements **Phases 0–23** of the product blueprint: the secure Next.js/Supabase foundation, authentication, family onboarding, discovery and matching, family connections and messaging, Villages and events, Roots missions and passport stories, AI jobs, notifications, moderation, billing, SEO, GDPR controls, PWA support, security hardening, and the Germany pilot control plane.

## Local development

1. Copy `.env.example` to `.env.local` and add non-production development credentials.
2. Install with `npm ci`.
3. Run `npm run dev`.
4. Validate with `npm run check`.

Production secrets live only in the untracked `.env.production`; do not copy them into source, issues, logs, or client-prefixed variables.

See [docs/deployment.md](docs/deployment.md), [docs/architecture.md](docs/architecture.md), and [docs/security.md](docs/security.md).
