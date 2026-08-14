# Localization inventory

## Purpose

This inventory is the L0 source-of-truth list for text a person can see,
receive, download, or hear from Kinavela. It was created from the 13 August
2026 localization audit and must be updated whenever a new user-facing text
surface is introduced.

"Localized" means complete German, French, and English product copy selected
from the interface locale. It does not require translating user-generated
content, product names, legal entity names, addresses, email addresses, stable
identifiers, ISO codes, or culturally specific names without an approved
localized form.

## Status legend

| Status          | Meaning                                                                |
| --------------- | ---------------------------------------------------------------------- |
| Guarded         | A typed translation source is in the L0 coverage registry.             |
| Partial         | Some copy is localized, but the surface still has English-only output. |
| English-only    | German and French users receive English product prose.                 |
| Design required | A future phase must add a locale-aware data or delivery model.         |
| Reviewed        | Complete and approved for all supported locales.                       |

## Current inventory

| Surface                                                                                                  | Delivery channel           | Current mechanism                                 | Status                       | Resolution   |
| -------------------------------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------- | ---------------------------- | ------------ |
| Landing page copy                                                                                        | Public web                 | `messages/*.json`                                 | Partial                      | L3           |
| Landing navigation, footer, illustration, and accessibility labels                                       | Public web                 | JSX literals                                      | English-only                 | L3           |
| Public community page body and metadata                                                                  | Public web / SEO           | Local function and `features/seo/public-pages.ts` | Partial                      | L3           |
| Legal navigation and six legal documents                                                                 | Public web                 | `components/legal/legal-page.tsx`                 | English-only                 | L1           |
| Cookie and metrics-consent settings                                                                      | Public web / app           | Component and app dictionary                      | Partial                      | L1           |
| Account-suspension explanation                                                                           | Account state              | JSX literals                                      | English-only                 | L1           |
| Authentication pages and application messages                                                            | Web and account email      | App dictionary and auth-email map                 | Guarded                      | L3/L5 review |
| Authentication email subjects and bodies                                                                 | Email                      | `features/auth/email-copy.ts`                     | Guarded                      | L5 review    |
| Notification email subjects and bodies                                                                   | Email                      | `features/notifications/email-copy.ts`            | Guarded                      | L5 review    |
| Push notification payloads                                                                               | Push                       | `lib/notifications/dispatcher.ts`                 | Partial                      | L5           |
| Push fallback when no body is supplied                                                                   | Service worker             | `public/sw.js` literal                            | English-only                 | L3/L5        |
| In-app notification feed                                                                                 | Authenticated web          | Application dictionary                            | Guarded                      | L4 review    |
| Invitation pages, previews, and share messages                                                           | Web / Web Share / WhatsApp | `features/invitations/copy.ts`                    | Guarded                      | L5 review    |
| Onboarding, dashboard, Settings, discovery, messages, events, Villages, billing, privacy, and offline UI | Authenticated web          | Application dictionary                            | Guarded                      | L4 review    |
| Playdate report reason options                                                                           | Authenticated web          | JSX literals                                      | English-only                 | L4           |
| Story recorder title default and recording indicator                                                     | Public recording page      | JSX literals                                      | English-only                 | L4           |
| Discovery location country label                                                                         | Authenticated web          | JSX literal plus reference data                   | English-only                 | L4           |
| Mission UI labels                                                                                        | Authenticated web          | `features/missions/copy.ts`                       | Guarded                      | L2 review    |
| Mission catalogue, materials, guidance, reflection, and steps                                            | Database / offline cache   | English data fields                               | English-only                 | L2           |
| Country, culture, and language display labels                                                            | Database                   | English `name` fields                             | Design required              | L2           |
| Roots Passport and story dates                                                                           | Authenticated web          | Browser-default date formatting                   | Partial                      | L4           |
| Report-response date                                                                                     | Authenticated web          | Undefined-locale `Intl` formatting                | Partial                      | L4           |
| PWA install prompt and offline page                                                                      | PWA                        | Application dictionary                            | Guarded                      | L3 review    |
| PWA manifest name and description                                                                        | Browser install UI         | Static manifest                                   | English-only for description | L3           |
| Root metadata and locale-specific SEO metadata                                                           | Browser / SEO              | Root metadata and page metadata                   | Partial                      | L3           |
| Personal-data export labels and supporting material                                                      | Download                   | JSON schema and privacy UI                        | Design required              | L5           |
| API validation and provider errors                                                                       | Web / APIs                 | Stable codes mixed with raw message utility       | Partial                      | L5           |
| Admin moderation and verification interface                                                              | Operator web               | JSX literals                                      | English-only                 | L4           |
| Screen-reader labels and image alternatives                                                              | Web accessibility          | JSX literals and dictionaries                     | Partial                      | L1/L3/L4     |

## Translation sources currently guarded by L0

The unit suite verifies key parity and non-empty strings for these sources:

- landing dictionaries;
- application dictionaries;
- authentication email copy;
- notification email copy;
- discovery activation;
- invitations;
- cultural missions;
- playdates and event coordination;
- Roots Passport;
- Roots Stories;
- trust and safety;
- Village support.

Adding another feature-owned dictionary requires registering it in
`lib/i18n/sources.ts` and adding it to this inventory.

## Literal-copy guardrail

`npm run i18n:report` reports static JSX labels, placeholders, alternatives,
titles, and inline text in `app/` and `components/`. It intentionally reports
the known English debt above during L0–L5. The checked-in allowlist covers only
Kinavela and Roots product marks; it must not contain ordinary interface copy. It is not yet a release-blocking
command because that would block the present worktree.

`npm run i18n:check` is already part of `npm run check` and blocks missing,
unexpected, or empty landing dictionary values. L4 changes the literal report to
strict mode only after the listed component debt is removed. L5 extends the
check to generated communications and provider error mappings. L6 makes the
complete inventory release-blocking.

## Ownership and change procedure

1. The feature author identifies the surface and adds/updates the inventory row.
2. Product copy is added to a typed source with German, French, and English
   values in the same change.
3. The source is registered in `lib/i18n/sources.ts` when it is product copy.
4. Dates, times, numbers, currency, lists, and relative time use
   `lib/i18n/format.ts` with an explicit Kinavela locale.
5. Database-backed content defines translation status, source locale, version,
   reviewer, and publication checks before it is published.
6. Legal, safety, and cultural content receives the review required by L1 or
   L2 before release.
7. Run `npm run i18n:check`, `npm run i18n:report`, focused tests, and the
   normal release qualification before deployment.

## Data-design decisions for later phases

### Reference data

Countries, cultures, and languages retain stable IDs and ISO codes. L2 adds
localized display projections keyed by locale; source-language and native names
remain available where intentional. A display component must receive both the
record and selected interface locale rather than rendering a raw `name` field.

### Cultural mission content

L2 uses additive translation records or an equivalently versioned structure for
every user-facing mission and step field. Each translation records source
locale, target locale, content version, review state, reviewer, and review time.
Mission RPCs accept a validated locale and return only reviewed content for that
locale. Progress and assignment records continue to point to the stable mission
and step IDs.

### Errors and communications

APIs and workers keep language-neutral stable error or notification codes.
Rendering and delivery boundaries map those codes to complete localized copy.
Technical provider messages stay in private logs and never become customer
copy.

### Locale formatting

Locale controls formatting language; a separately explicit time-zone value
controls the calendar/time-zone interpretation. Helpers default to no hidden
browser or server locale, and callers supply a time zone where the product
requires a fixed calendar view.
