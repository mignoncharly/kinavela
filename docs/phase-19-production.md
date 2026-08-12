# Phase 19 — GDPR hardening

This is the implemented Priority 0 privacy and legal package. It records the production facts determined from code and deployment; controller and legal review remain responsible for any final legal sign-off.

## Data inventory

| Activity            | Data                                                                           | Recipients                                        | Product rule                                               |
| ------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------- | ---------------------------------------------------------- |
| Account/auth        | email, auth identifier, profile preferences                                    | Supabase Auth/Database                            | active account plus deletion workflow                      |
| Family and children | family profile, child nickname/year, culture/language links                    | Supabase Database                                 | guardian access; minimise child data                       |
| Stories/media       | voice, transcripts, passport media                                             | private Supabase Storage; AI only when configured | private buckets; delete media before account anonymisation |
| Safety              | messages, reports, moderation metadata                                         | restricted Kinavela/Supabase access               | retain only for safety and legal review                    |
| Billing             | Stripe Customer and subscription identifiers, minimized webhook audit metadata | Stripe, Supabase Database                         | Roots Family active; family owner manages billing          |
| Notifications       | email consent, push endpoint keys, delivery payloads                           | Zoho SMTP, Supabase                               | opt-in email and revocation                                |

The canonical machine-readable inventory is `kinavela_private.processing_activities`.

## Retention and deletion

The implemented defaults are 7 days for personal-data export files, 30 days for expired story requests and notification outbox entries, 90 days for event reminders, 365 days for notifications, 180 days for opt-in product metrics, 730 days for security and moderation records, 90 days for completed deletion requests, and expiry-based deletion for geocoding cache rows. Active family content remains until account deletion; private child and story media is removed first. A daily privacy systemd timer invokes the secured privacy cron.

The privacy cron claims one export and one account deletion per run. It removes private objects first, then anonymises the profile and authored messages, removes optional consents/preferences, marks family membership removed and disables the Supabase Auth account. Referentially restricted records are retained only as an anonymised safety/integrity tombstone.

## Processor and transfer review

The production processor inventory is Supabase, Zoho Europe SMTP, Nominatim/OpenStreetMap and Stripe for Roots Family billing. OpenAI, Sentry, analytics, advertising, CAPTCHA and Web Push delivery remain disabled and excluded from the public policy. Supabase project region, hosting operator and contractual transfer mechanisms still require provider-console or contract confirmation; they are not invented from source code.

## Cookie and consent audit

The app uses authentication/session cookies and local PWA storage. No non-essential analytics or advertising cookie is enabled by this phase. Product email is a separate, revocable consent. Push notifications require browser permission and a stored subscription. Re-run this audit after adding analytics or embedded media.

## Backup policy

Backups are processor-controlled infrastructure copies. Document retention, region, restore access, deletion propagation and legal holds with the hosting/Supabase provider. A user deletion acknowledgement must not claim that every immutable backup copy has disappeared immediately.

## Required public documents

The finalized documents are `docs/privacy-policy.md`, `docs/terms.md`, `docs/community-guidelines.md`, `docs/child-safety-policy.md`, `docs/cookie-policy.md` and `docs/impressum.md`; the public renderer exposes all six documents in each supported locale route.
