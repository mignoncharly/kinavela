# Phase 15: release qualification

Phase 15 qualifies the Germany-wide Kinavela release against the functional,
security and product-acceptance requirements in `new_implementation_plan.md`.
The release decision is based on repeatable automated evidence, not on opening
cities, changing regional status or overriding a family cap.

## Product acceptance scenario

`supabase/tests/0038_release_qualification_scenario.sql` executes the original
scenario as one transaction and rolls back every synthetic record. It verifies
that a mother in Schrobenhausen can:

1. register a family with Cameroonian roots and a guardian-managed child;
2. change and restore her real city-level location;
3. discover a nearby Ingolstadt family by shared culture and child-age range;
4. connect and exchange a private family message;
5. create `Cameroonian Families · Ingolstadt Region` and add the family;
6. create a picnic whose exact address remains hidden until a safety-aware RSVP;
7. ask a privacy-confirmed school-support question;
8. complete every step of a reviewed Cameroonian cultural mission;
9. save the activity to the child's private Roots Passport and request an export.

The scenario additionally asserts that neither test family receives a legacy
admission-waitlist row.

## Functional evidence

| Requirement                              | Automated evidence                                                                                                                                        |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Signup from arbitrary German towns       | `0003_onboarding_rpc.sql`, `0023_phase_a_enforcement.sql`, `0038_release_qualification_scenario.sql`                                                      |
| German, French and English onboarding    | `i18n-application.test.tsx`, `onboarding-validation.test.ts`                                                                                              |
| Location changes                         | `0004_location_discovery_rls.sql`, `0038_release_qualification_scenario.sql`                                                                              |
| Culture and child-age discovery          | `0004_location_discovery_rls.sql`, `0005_deterministic_matching.sql`, `0026_child_connection_visibility.sql`, `0038_release_qualification_scenario.sql`   |
| Connection and messaging                 | `0006_family_connections.sql`, `0007_family_messaging.sql`, `0038_release_qualification_scenario.sql`                                                     |
| External invitation through registration | `0027_invitation_links.sql`, `invitations-api.test.ts`, `invitations.test.ts`                                                                             |
| Village creation and membership          | `0008_villages.sql`, `0038_release_qualification_scenario.sql`                                                                                            |
| Event RSVP and address rules             | `0009_village_events.sql`, `0029_trust_and_child_meeting_safety.sql`, `0031_offline_activity_coordination.sql`, `0038_release_qualification_scenario.sql` |
| Support questions                        | `0030_village_support_board.sql`, `support-api.test.ts`, `0038_release_qualification_scenario.sql`                                                        |
| Passport media and export                | `0012_roots_passport.sql`, `0033_complete_roots_passport.sql`, `roots.test.ts`, `0038_release_qualification_scenario.sql`                                 |

## Security evidence

| Requirement                                     | Automated evidence                                                                                                                                         |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RLS and IDOR protection for new tables and RPCs | Complete `supabase/tests` suite, especially `0021` through `0038`                                                                                          |
| Invitation expiry and revocation                | `0027_invitation_links.sql`                                                                                                                                |
| Block enforcement                               | `0004_location_discovery_rls.sql`, `0006_family_connections.sql`, `0007_family_messaging.sql`, `0027_invitation_links.sql`                                 |
| Event-report authorization                      | `0029_trust_and_child_meeting_safety.sql`, `0031_offline_activity_coordination.sql`                                                                        |
| Child-data projections                          | `0026_child_connection_visibility.sql`, `0033_complete_roots_passport.sql`                                                                                 |
| Signed media URLs and upload validation         | `0012_roots_passport.sql`, `0013_roots_stories.sql`, `0033_complete_roots_passport.sql`, `security.test.ts`, `roots.test.ts`                               |
| Notification minimization                       | `0015_notifications.sql`, `0025_notification_web_push_delivery.sql`, `0035_notification_communication_reliability.sql`, `notifications.test.ts`            |
| Rate limits                                     | Connection, messaging, invitation, support, story, notification and request-security suites                                                                |
| Account deletion and retention                  | `0020_gdpr_hardening.sql`, `0030_village_support_board.sql`, `0031_offline_activity_coordination.sql`, `0037_legacy_pilot_cleanup.sql`, privacy unit tests |

## Release gate

Run:

```bash
npm run release:qualification
```

The gate validates the environment, scans tracked files for secrets, rejects
high-severity production dependency findings, runs formatting, ESLint,
TypeScript, unit tests and a production build, applies pending migrations, runs
all remote transactional database assertions, and executes the Android Chrome,
iOS Safari and desktop Playwright projects. Set `SMOKE_BASE_URL` to additionally
qualify the public HTTPS deployment.

Browser assertions exercise public pages and authentication boundaries. The
database journey owns the destructive functional scenario because PostgreSQL
can guarantee rollback even when an intermediate assertion fails.

## Release decision

The release is qualified only when the complete gate exits successfully and
the deployed service passes health, readiness and public smoke checks. Any
failed criterion blocks release; it must not be waived by manually changing a
city, region or capacity setting.
