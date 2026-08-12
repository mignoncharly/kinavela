# Phase 24 — Privacy and public-surface completeness

Phase 24 closes the code-level privacy and public-surface gaps found after security hardening.

## Delivered

- Ready personal-data exports now download as private JSON attachments instead of returning a JSON wrapper containing a storage URL.
- Export retrieval continues to require the authenticated owner projection and uses a short-lived internal storage URL.
- The public landing page links directly to the privacy policy, terms and contact address.
- Repository documentation now reflects the implemented Phases 0–23, the deployed private storage buckets and the server-side AI boundary.

## Controller and legal review still required

The public privacy, terms, cookie, child-safety and imprint wording remains a controller/legal deliverable. The repository deliberately does not invent the legal entity address, supervisory authority, retention approvals, processor agreements or transfer safeguards. Those values must be approved before public launch and then reflected consistently in the public pages and policy documents.

## Qualification

Run `npm run check`, `npm run db:migrate`, and `npm run db:test` after deployment. Verify that a ready export downloads with `Content-Disposition: attachment`, expires according to the approved retention policy, and remains inaccessible to another authenticated profile.
