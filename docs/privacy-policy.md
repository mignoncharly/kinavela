# Privacy Policy

Version 1.0  
Effective date: 11 August 2026  
Last updated: 11 August 2026

## 1. Controller

Gestiona Tech – Nguenkam Charles, Einzelunternehmen  
Nikolausstraße 6  
55120 Mainz, Deutschland  
Email: info@gestionatech.de

Privacy contact: privacy@gestionatech.de. No formal Data Protection Officer has been appointed. The privacy contact is not a DPO.

## 2. Scope and data

Kinavela processes account and authentication data, family and discovery data, guardian-managed child data, Roots Passport and Roots Stories content, messages, events, notifications, reports, moderation records, consent records and security metadata. Children do not receive public accounts. Child records contain only the fields selected by the guardian, including nickname, birth year, optional birth month and optional gender.

City/postcode searches are sent server-side to Nominatim/OpenStreetMap. Exact device GPS and exact home addresses are not used for discovery.

## 3. Purposes and legal bases

- Service delivery, onboarding, family tools, Roots, messaging and community features: Art. 6(1)(b) GDPR.
- Security, abuse prevention, moderation and incident handling: Art. 6(1)(f) GDPR and, where applicable, Art. 6(1)(c) GDPR.
- Optional product email: Art. 6(1)(a) GDPR; consent can be withdrawn in Settings.
- Optional first-party product metrics and the related browser storage: opt-in consent. The service remains usable after refusal.
- Statutory accounting or tax records: Art. 6(1)(c) GDPR where the obligation exists.

Cultural, heritage and language information is supplied voluntarily and may reveal sensitive identity aspects. Users must only enter information they are authorised to process.

## 4. Production processors and transfers

The production deployment uses:

- Supabase for Auth, PostgreSQL, private Storage and Realtime.
- Zoho Europe SMTP at smtp.zoho.eu for account and opted-in notification email.
- Nominatim/OpenStreetMap for explicit server-side city or postcode searches.

The exact Supabase project region and the processor transfer mechanism are controlled in provider administration and are not asserted from application source alone. The SMTP endpoint is European; its hostname alone is not an EU-only storage guarantee. Applicable transfer safeguards are maintained in the controller's processor records.

Stripe is used for hosted subscription Checkout, customer billing Portal sessions and payment webhooks. It receives the billing identifiers and payment information needed to process Roots Family subscriptions; Kinavela does not receive full card data. OpenAI processing, Sentry, third-party analytics, advertising, CAPTCHA and Web Push delivery remain disabled.

## 5. Retention

| Resource                                    | Retention                                                     |
| ------------------------------------------- | ------------------------------------------------------------- |
| Account, family, guardian and child data    | Active account lifetime, followed by the deletion workflow    |
| Roots media and story audio/transcripts     | While retained by the family; removed during deletion         |
| Personal-data export file and row           | 7 days after ready                                            |
| Expired or revoked story requests and media | 30 days after expiry or revocation                            |
| Notification outbox                         | 30 days                                                       |
| Event reminder deliveries                   | 90 days                                                       |
| In-app and connection notifications         | 365 days                                                      |
| First-party product metrics                 | 180 days                                                      |
| Security, moderation and audit events       | 730 days unless a safety, legal or incident hold applies      |
| Provider-controlled backups                 | Per the configured backup cycle; deletion may propagate later |

The privacy cron automates export expiry, account deletion, story-media cleanup and operational retention. Account deletion removes private media first, deletes child/story content where technically possible, anonymises authored messages and preserves only a minimal safety/integrity tombstone when a foreign-key or safety need prevents immediate physical deletion. Statutory records are retained for the legally required period.

## 6. Rights

Subject to the GDPR conditions, data subjects may request access, correction, deletion, restriction, portability or object to processing. Consent can be withdrawn at any time. Requests may be made in Settings or by email to privacy@gestionatech.de.

## 7. Supervisory authority

Der Landesbeauftragte für den Datenschutz und die Informationsfreiheit Rheinland-Pfalz (LfDI Rheinland-Pfalz)  
Postfach 30 40, 55020 Mainz  
Visitor address: Hintere Bleiche 34, 55116 Mainz  
Telephone: +49 (0) 6131 8920-0  
Email: poststelle@datenschutz.rlp.de  
https://www.datenschutz.rlp.de/

## 8. Security and changes

Private Storage buckets, signed access, RLS, least privilege, request protections and restricted service access are used. This policy may be updated when processing, providers or legal requirements change.
