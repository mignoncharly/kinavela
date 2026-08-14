# Production privacy inventory

Audit date: 13 August 2026
Application: Kinavela at https://www.kinavela.com

## Processing inventory

| Area                  | Evidence in the deployed application                                                         | Data                                                                                                        | Purpose                                              |
| --------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Auth and account      | Supabase Auth, `profiles`, signup/login/recovery routes                                      | Email, auth ID, display name, language, status                                                              | Account and access                                   |
| Onboarding and family | `families`, `family_members`, preferences and reference tables                               | Family name, city, approximate location, culture, language, interests, availability                         | Family service and discovery                         |
| Children              | `children`, Roots Passport tables                                                            | Nickname, birth year, optional month/gender, guardian content                                               | Guardian-managed heritage                            |
| Stories and media     | `family_stories`, `story_requests`, private `story-audio`                                    | Audio, transcripts, titles, child/family references                                                         | Requested stories                                    |
| Messaging and safety  | conversations, messages, Village support posts/replies, reports and moderation               | Private communications, practical support, reports, moderation metadata                                     | Communication, mutual support and safety             |
| Events and Villages   | events, attendance, reminder delivery, private event location                                | Event participation and location details                                                                    | Community events                                     |
| Notifications         | preferences, in-app outbox/events, optional push subscriptions                               | Email preference, notification payload, push keys                                                           | Service notices                                      |
| Operations            | audit events, request rate limits, product events, geocoding cache, legacy migration archive | Security metadata, hashed identifiers, opt-in metrics, city-search cache, bounded historical waitlist state | Security, operations and reversible access migration |
| Billing               | Stripe Customer and subscription identifiers, minimized webhook audit metadata               | Stripe, Supabase Database                                                                                   | Roots Family subscriptions; family owner only        |
| AI                    | Code exists, but AI provider is disabled in production                                       | None sent to OpenAI by current deployment                                                                   | Not active                                           |
| Monitoring            | Sentry package exists, DSN is empty                                                          | No Sentry events by current deployment                                                                      | Not active                                           |

## Processors actually used

1. Supabase: Auth, database, Storage and Realtime. Project region and transfer mechanism require provider-console confirmation; not inferred from the URL.
2. Zoho Europe SMTP: transactional and opted-in notification email. Configured endpoint: `smtp.zoho.eu`.
3. Nominatim/OpenStreetMap: explicit server-side city/postcode geocoding. Configured default: `https://nominatim.openstreetmap.org`.
4. Stripe: hosted Roots Family Checkout, Customer Portal and payment webhooks. Kinavela stores only billing identifiers and minimized webhook audit metadata; Stripe handles payment method and invoice records.
5. Browser/operating-system push service: only after explicit Web Push permission and device registration; the exact service is determined by the subscription endpoint.

The application server/Nginx is self-managed for the controller, but its commercial hosting operator is not identified in the repository and is not given a fictional name in the public policy.

## Browser storage

- Supabase Auth cookie family: necessary session storage; exact expiry follows Supabase Auth project settings.
- `kinavela:metrics-consent`: localStorage consent choice until changed.
- `kinavela:app_session_started`: sessionStorage marker until tab/session end, only after metrics consent.
- `kinavela-offline-v1`: IndexedDB snapshots, automatically removed after 30 days.
- `kinavela-shell-v2`: service-worker Cache Storage for static/offline shell only.
- Browser PushManager subscription: device endpoint and keys until revoked, expired, uninstall or browser clear.

No advertising, social, third-party analytics, CAPTCHA or embedded payment widget is installed. Stripe-hosted Checkout and Portal pages open on Stripe infrastructure. Web Push requires an explicit Settings action and browser permission and remains controlled by the `web_push_delivery` rollout. No consent banner is used for authentication/PWA necessities; the banner exists only for opt-in first-party product metrics.

## Retention controls

The database retention migration and privacy cron cover the 180-day private legacy-waitlist rollback archive, exports, story requests/media, notification queues/events, event reminders, product metrics, geocoding cache/rate-limit hashes, AI job data if ever enabled, and short-lived operational records. Active account content remains until the account deletion workflow; private child/story media is removed first, and authored Village support text is tombstoned and replaced when the profile is deleted.

## Access, Storage and localization audit

- Public data tables remain forced-RLS; the new child read policy permits only active owner or guardian membership to read child rows directly. Discovery uses server-side privacy-safe projections.
- The roots-media, story-audio and privacy-exports buckets are private. Account deletion claims roots media, story audio and export paths before database anonymisation; expiry cleanup removes story audio and export files.
- The product UI supports de, fr and en routes. The document language is synchronized to the route. The six legal documents currently use one canonical English legal text across localized routes; no unsupported translation has been invented.
