# Kinavela

Phase documentation includes [complete multilingual application support](docs/phase-31-production.md),
[secure WhatsApp-friendly invitations](docs/phase-32-production.md), and
[low-density activation without access blockers](docs/phase-33-production.md).
The child-meeting trust controls are documented in
[Phase 34](docs/phase-34-production.md). Structured practical support inside
private Villages is documented in [Phase 35](docs/phase-35-production.md).
Safe offline coordination is documented in
[Phase 36](docs/phase-36-offline-coordination.md). Mobile acquisition and the
legacy data cleanup are documented in [Phase 13](docs/phase-13-mobile-onboarding.md)
and [Phase 14](docs/phase-14-legacy-cleanup.md). The completed,
review-gated cultural activity catalogue from the new implementation plan's
[Phase 9](docs/phase-9-cultural-activities.md) is also documented.
The completed memory-management and export workflow from the new plan's
[Phase 10](docs/phase-10-roots-passport.md) is also documented.
The plan concludes with the repeatable
[Phase 15 release qualification](docs/phase-15-release-qualification.md).

Kinavela is the production foundation for a privacy-first platform that helps diaspora families build trusted local communities and preserve cultural memories for their children.

This repository implements the production product blueprint: the secure Next.js/Supabase foundation, authentication, family onboarding, discovery and matching, family connections and messaging, Villages and events, secure referrals and invitations, Roots missions and passport stories, AI jobs, notifications, moderation, billing, SEO, GDPR controls, PWA support, security hardening, Germany-wide geocoded access, and complete owner-managed family profiles.

## Local development

1. Copy `.env.example` to `.env.local` and add non-production development credentials.
2. Install with `npm ci`.
3. Run `npm run dev`.
4. Validate with `npm run check`.

Production secrets live only in the untracked `.env.production`; do not copy them into source, issues, logs, or client-prefixed variables.

See [docs/deployment.md](docs/deployment.md), [docs/architecture.md](docs/architecture.md), and [docs/security.md](docs/security.md).
