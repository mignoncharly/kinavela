# Kinavela blog — implementation plan

## Decisions locked

| Decision  | Choice                                                          |
| --------- | --------------------------------------------------------------- |
| Authoring | Markdown files in the repo: `content/blog/<slug>/<locale>.md`   |
| Locales   | DE-first; FR/EN translations trail, per-post availability       |
| Voice     | Founder byline plus community voices (interviews, guest pieces) |

The git review gate is the reason the file-based model was chosen. It is the
mechanism that enforces the editorial standard in Phase 4 — not an incidental
side effect of storing content in the repo.

---

## Findings that shape this plan

Everything below was checked against the running site and this codebase, not
assumed.

### 1. Every public page is dynamically rendered per request

`app/layout.tsx:74` calls `headers()` to read `x-kinavela-locale`, and the file
declares `export const dynamic = "force-dynamic"`. Confirmed in production —
both `/de` and `/de/community/cameroonian-families-in-berlin` return:

```
Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate
```

`app/[locale]/community/[slug]/page.tsx` declared `revalidate = 3600` and
`dynamicParams = false`. Those declarations never took effect — a build confirms
the route as `ƒ /[locale]/community/[slug]`, dynamic. They have since been
removed, and the reason documented in place.

**`force-dynamic` is load-bearing.** See finding 2 — it is required by the CSP,
not left there by accident.

### 2. The per-request CSP nonce is what forces dynamic rendering

`proxy.ts:16` generates a nonce per request and sets
`script-src 'self' 'nonce-…' 'strict-dynamic'`. Under `strict-dynamic`, `'self'`
is ignored by compliant browsers — **only nonce-stamped scripts execute**.
Production HTML confirms this: 14 tags carry the nonce matching the response
header.

`node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md:181`:

> To use a nonce, your page must be **dynamically rendered**. This is because
> Next.js applies nonces during **server-side rendering**, based on the CSP
> header present in the request. Static pages are generated at build time, when
> no request or response headers exist—so no nonce can be injected.

A prerendered page would therefore ship a nonce that can never match the
response header, and `strict-dynamic` would block every script on it: no
hydration, no consent banner, no PWA runtime. **Do not remove `force-dynamic`
from the root layout without first moving the public routes off the nonce CSP.**

### 3. Route segment config is version-sensitive here

Next 16.3.0. Per `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/index.md`,
`dynamic`, `dynamicParams`, `revalidate` and `fetchCache` are **removed when
Cache Components is enabled**. `next.config.ts` does not enable
`cacheComponents`, so the legacy options still work today — but the blog should
not be built on options that a single config flag deletes.

### 4. The localization checker will fight the blog if content goes in the wrong place

- `dictionaryIssues()` in `scripts/check-localization.mjs` requires exact key
  parity across `messages/{de,fr,en}.json`. A DE-first blog fails CI the moment
  a post exists in German only. **Post bodies must never live in `messages/*.json`.**
- `sourceLiteralFindings()` scans every `.tsx` under `app/` and `components/`
  for user-facing string literals. **Post bodies must never be inline JSX either.**
- Files under `content/` are invisible to both checks. The chosen authoring
  model is already the compatible one — this is confirmation, not luck.

### 5. There is existing SEO machinery to extend, not rebuild

`app/robots.ts`, `app/sitemap.ts` (including the fully-qualified hreflang
helper `alternatesFor`), `app/opengraph-image.tsx`, and a working
`scripts/indexnow.mjs` with a live key. The homepage JSON-LD `@graph` already
exposes stable `@id`s — `https://www.kinavela.com/#organization` and
`#website` — which article nodes should reference rather than redeclare.

### 6. Conventions to follow

- Numbered phase stylesheets imported in `app/layout.tsx`. Next free number is **37**.
- `app/[locale]/community/[slug]/page.tsx` is the closest existing model for a
  public, SEO-oriented, JSON-LD-carrying page. Reuse its header, footer and
  breadcrumb shape.
- `components/legal/legal-page.tsx` shows the house pattern for rendering
  structured long-form content.

---

## Phase 0 — Prerender the public surface — CLOSED, NOT DOING

**Original goal:** make a blog post a static file served from cache rather than
a per-request render.

**Outcome:** rejected on investigation. The cost is a security downgrade; the
benefit is close to zero on the current infrastructure.

### Why it was rejected

Prerendering requires removing `force-dynamic` from the root layout, and that
export exists to satisfy the nonce-based CSP (finding 2). Losing it would ship
pages whose baked nonce can never match the response header, and `strict-dynamic`
would then block every script on them.

Making the public routes prerenderable therefore means giving them a nonce-free
CSP — dropping from `script-src 'self' 'nonce-…' 'strict-dynamic'` to
`script-src 'self'`, which permits any same-origin script URL. That is a real
weakening of the policy on a product handling children's data.

What that would buy, measured rather than assumed:

- `deploy/nginx.conf` contains **no `proxy_cache` directives**. nginx proxies
  straight to Next on `127.0.0.1:3020`; only `/_next/static/` is given cache
  headers. Nothing in front of the app caches HTML today.
- There is no CDN. Single origin, `82.165.94.233`.
- TTFB on `/de` is already **27 ms**.

So prerendering would save server CPU on a box that already answers in 27 ms,
and would not change what any user or crawler experiences until nginx caching is
added too. Bad trade at current scale.

### What was done instead

Removed the inert `revalidate = 3600` and `dynamicParams = false` from
`app/[locale]/community/[slug]/page.tsx` and documented the CSP dependency in
place, so the next reader is not misled into thinking the route is cached — or
into "fixing" `force-dynamic` and silently breaking the site.
`generateStaticParams` is kept, inert, for the day the CSP question is revisited.
Unknown slugs were and remain handled by the explicit `notFound()`.

### Revisit when

Any one of: a CDN goes in front of the origin; nginx gains `proxy_cache`; server
render cost becomes a real constraint; or the public routes are separated from
the app's CSP for another reason. At that point the options are a route-split
CSP (nonce-free for public, nonce for the app) or a hash-based policy.

---

## Phase 1 — Content pipeline — BUILT

**Goal:** markdown on disk becomes typed, validated data at build time.

**Status:** shipped. 48 tests across `tests/unit/blog-frontmatter.test.ts`,
`blog-markdown.test.ts`, `blog-markdown-security.test.ts` and
`blog-registry.test.ts`. One new dependency, `marked@18` (no transitive deps).

Two decisions changed during implementation:

- **Frontmatter is parsed in-house, not with `gray-matter`.** The format is a
  fixed flat key set, and every failure names the file and line, so a malformed
  post fails the build rather than being silently mis-read. That loudness is
  what makes avoiding the dependency safe.
- **There is no DOM sanitiser.** Instead the markdown renderer is built so it
  _cannot_ emit raw HTML or an out-of-allowlist URL — nothing parses hostile
  HTML because nothing ever constructs it. `blog-markdown-security.test.ts`
  asserts this against 16 payloads at the parsed-DOM level rather than by string
  matching, which would produce false alarms on correctly escaped output like
  `alt="&quot; onerror=&quot;x"`.

### Shape

```
content/blog/
  warum-wir-kinavela-bauen/
    de.md
    fr.md
    en.md
  authors.ts

features/blog/
  registry.ts       discovers posts, parses frontmatter, sorts
  frontmatter.ts    zod schema
  markdown.ts       markdown -> sanitized HTML
  types.ts
```

### Frontmatter schema

Validated with `zod`, already a dependency.

```yaml
title: # h1 and <title>
excerpt: # meta description and index card
author: # key into authors registry
published: # ISO date
updated: # optional, drives sitemap lastmod
tags: # optional
heroImage: # optional
heroAlt: # required when heroImage is set
originalLocale: # de | fr | en — which language this was written in
translator: # optional, set when this file is a translation
consentRef: # optional, see Phase 5
```

### Rules

- Availability is per `(slug, locale)` and derived from **which files exist**.
  No central list to keep in sync, nothing to forget to update.
- A `published` date in the future excludes the post from the build. Scheduling
  for free.
- Parsing happens at build / module load, never per request.

### Dependencies

`gray-matter` (or a thirty-line frontmatter splitter), plus `marked` or
`remark` + `rehype`, plus sanitization. The content is git-reviewed and
therefore trusted, but community-contributed prose is exactly where a stray
`<script>` arrives. Sanitize anyway.

`@next/mdx` is documented in `node_modules/next/dist/docs/01-app/02-guides/mdx.md`,
but it is built around `.md`/`.mdx` files acting as _routes_ via
`pageExtensions`. Content addressed as `content/blog/<slug>/<locale>.md` is not
a route, so a plain parser fits better and avoids adding four packages.

### Tests

Frontmatter rejection cases; future-dated exclusion; locale availability
derivation; sanitizer strips `<script>` and `on*` handlers.

---

## Phase 2 — Routes and rendering — BUILT

**Goal:** the blog exists at a URL, in the right languages, without breaking
the localization gates.

**Status:** shipped. `app/[locale]/blog/page.tsx`,
`app/[locale]/blog/[slug]/page.tsx`, `app/phase37-blog.css`, an 18-key `blog`
section in all three dictionaries, `features/blog/seo.ts`,
`features/blog/copy.ts`, and `formatLanguage()` in `lib/i18n/format.ts`.
13 further tests in `tests/unit/blog-routes.test.ts`.

Verified against a real render, not just unit tests:

| Check                                      | Result                                       |
| ------------------------------------------ | -------------------------------------------- |
| `/de/blog`, `/fr/blog`, `/en/blog`         | 200, each in its own language                |
| `/de/blog/erster-beitrag`                  | 200                                          |
| `/en/blog/erster-beitrag` (no translation) | 404                                          |
| `/de/blog/geplant` (future-dated)          | 404                                          |
| hreflang on a de+fr post                   | lists `de`, `fr` only — no `en`              |
| `x-default`                                | points at the original language              |
| `<script>` in a post body                  | stripped                                     |
| `javascript:` link in a post body          | degraded to plain text                       |
| markdown `#`                               | rendered `<h2>`; exactly one `<h1>` per page |

Language names come from `Intl.DisplayNames` rather than nine dictionary
entries, which keeps the grammar right in each language — "Nur auf Deutsch",
"Uniquement en allemand", "Only in German".

### Work

- `/[locale]/blog` (index) and `/[locale]/blog/[slug]` (post).
- `generateStaticParams` emits only `(locale, slug)` pairs that actually have a
  file, so `/en/blog/<de-only-post>` 404s instead of serving German text under
  an English URL.
- `hreflang` on a post lists **only** the locales that exist for it.
  `x-default` points at the original-language version, not blindly at `/de`.
- A DE-only post viewed in the `/en` index: show it with a "nur auf Deutsch"
  marker linking to `/de/blog/<slug>`, rather than hiding it. Readers in this
  audience are frequently multilingual; hiding it loses more than it protects.
- All chrome strings — "Alle Beiträge", "Veröffentlicht am", "Von", reading
  time — go into `messages/*.json` under a `blog` key, in all three locales, so
  parity CI stays green. Post bodies do not.
- Reuse the header, footer and brand shape from
  `app/[locale]/community/[slug]/page.tsx`.
- New `app/phase37-blog.css`, imported in `app/layout.tsx` after
  `phase36-offline-coordination.css`.

> `findStaticUserFacingLiterals` will flag any literal text in the new `.tsx`
> files. Keep them clean from the first commit rather than retrofitting.

---

## Phase 3 — SEO, feeds, discovery — BUILT

**Goal:** every post is discoverable by search engines and citable by
assistants.

**Status:** shipped. `features/blog/jsonld.ts`, `features/blog/feed.ts`,
`features/blog/site.ts`, `app/[locale]/feed.xml/route.ts`,
`app/[locale]/blog/[slug]/opengraph-image.tsx`, blog entries in
`app/sitemap.ts`, and a `community` frontmatter key linking a post to a
`/community/<slug>` page. 16 further tests in `tests/unit/blog-seo.test.ts`.

Verified against a real render:

| Check                          | Result                                                             |
| ------------------------------ | ------------------------------------------------------------------ |
| Post JSON-LD                   | `WebPage` + `BlogPosting` + `BreadcrumbList` + `Person`            |
| `publisher` / `isPartOf`       | reference `#organization` / `#website` — no duplicate Organization |
| `author`                       | `Person` with stable `@id` `…/#person-admin`                       |
| Sitemap: `nur-deutsch`         | `de` + `x-default` only — no `fr`/`en` 404s announced              |
| Sitemap: per-post `lastmod`    | each post's own date, not the hardcoded one                        |
| Sitemap: index `lastmod`       | newest post's date                                                 |
| `/de/feed.xml`                 | 200, `application/rss+xml`, parses, RFC 822 dates                  |
| Per-post OG image              | 200, `image/png`, 1200×630, carries title and author               |
| RSS autodiscovery on the index | present                                                            |
| Community page → blog          | reverse link added to its nav                                      |

Two things worth recording:

- **A post's `community` slug is verified at load time**, alongside the author
  key. A typo fails the build rather than shipping an internal link to a 404 —
  which would waste exactly the crawl equity the cross-link exists to build.
- **IndexNow needed no new code.** `scripts/indexnow.mjs` already reads
  `<loc>` out of the sitemap, so blog URLs are covered the moment they appear
  there. Per-post submission also already works:
  `npm run seo:indexnow -- /de/blog/<slug>`. Not run from here — it is an
  outward-facing submission and yours to fire.

### Work

- `BlogPosting` JSON-LD per post, referencing the existing graph rather than
  redeclaring it:
  `publisher: { "@id": "https://www.kinavela.com/#organization" }`,
  `isPartOf: { "@id": "https://www.kinavela.com/#website" }`, and `author` as a
  `Person` with a stable `@id` and `sameAs` links.
- `BreadcrumbList` matching the community page pattern. A `Blog` node for the index.
- `app/sitemap.ts`: add the index and per-post entries. Use each post's real
  `updated ?? published` as `lastModified` instead of the hardcoded
  `2026-08-11`. Emit only `(locale, slug)` pairs that exist.
- `app/[locale]/feed.xml/route.ts` — RSS per locale. Cheap to build, and it is
  how humans and aggregators subscribe.
- Per-post OG image: extend the existing `app/opengraph-image.tsx` pattern to
  `app/[locale]/blog/[slug]/opengraph-image.tsx`.
- Publish hook: `npm run seo:indexnow -- /de/blog/<slug>` after deploy. Consider
  folding it into the deploy script.
- Internal linking: each post links to a relevant `/community/<city>` page, and
  those pages link back. This is the mechanism most likely to finally get the
  city pages indexed.

---

## Phase 4 — The human-voice system — BUILT

**Goal:** make "reads like a person wrote it" a checkable property rather than
a hope. Everything before this phase is plumbing; this is the actual ask.

**Status:** shipped. `docs/blog-editorial-standard.md`,
`scripts/check-blog-voice.mjs`, `npm run blog:check` and `blog:check:strict`,
plus a `placeholderBio` flag on `BlogAuthor`. 20 tests in
`tests/unit/blog-voice.test.mjs`.

### What the linter actually catches

Run against a deliberately generic German post, it reported **8 findings**:
five banned phrases with line numbers and excerpts, a `Fazit` heading, two
lists of exactly three items, and six paragraphs whose lengths varied by a
coefficient of 0.08. Run against a specific, human-sounding post of similar
length: **zero**.

Rules: `banned-phrase`, `conclusion-heading`, `question-heading`,
`list-monotony`, `uniform-paragraphs`, `em-dash-density`, `no-specifics`,
`placeholder-bio`.

### Three decisions worth recording

- **The ban list is per language.** An English-only list would check nothing on
  a German-first blog, so German and French carry their own — "in der heutigen
  schnelllebigen Zeit", "spielt eine wichtige Rolle", "dans le monde
  d'aujourd'hui". Only `game-changer`, `tapestry` and `holistic` are shared.
- **"nicht nur … sondern auch" is deliberately not banned.** It is ordinary
  German, as "non seulement … mais aussi" is ordinary French. Only the English
  "it's not just X, it's Y" beat is a tell rather than grammar. Flagging the
  others would generate false positives on natural writing, and a linter that
  cries wolf gets muted.
- **`no-specifics` is honestly a proxy.** The real rule — every post contains
  something only a human here could know — is not machine-checkable. The script
  checks only that a post over 120 words names _some_ date, number or month,
  and both the script and the standard say so plainly. The reviewer does the
  rest.

Author bios can ship with `placeholderBio: true`, which the check reports until
the content owner approves the wording. The current public label and bio were
approved by the site owner, so the placeholder flag is absent.

`vitest.config.ts` now includes `tests/unit/**/*.test.mjs` so the CLI script is
covered by real tests rather than a hand-rolled `--self-test` flag. `tsconfig`
only includes `.ts`/`.tsx`, so typecheck is unaffected.

### `docs/blog-editorial-standard.md`

Concrete rules, not aspirations:

- **Every post contains at least one thing only a human at Kinavela could
  know**: a date, a place, a real conversation, a mistake you made, a number
  from your own data.
- Open with a specific scene or claim. Never with a definitional throat-clear
  ("In today's increasingly connected world…", "Community is important
  because…").
- Keep German, French and Cameroonian specificity untranslated where it is
  real — Ndolé, Anmeldung, Kita-Platz, quartier. Do not flatten it into
  generic, English-shaped prose.
- Length is whatever the story needs. No word-count target.

**Ban list, enforced by lint:** delve, leverage, robust, seamless, navigate the
complexities, in today's fast-paced, "it's not just X, it's Y", furthermore /
moreover chains, let's dive in, at the end of the day, game-changer, unlock,
empower, tapestry, testament to.

**Structural tells to reject in review:** every list having exactly three
items; uniform paragraph length throughout; every section built to the same
shape; a bolded takeaway closing each section; a "Conclusion" heading; a
rhetorical question used as a subhead.

### `scripts/check-blog-voice.mjs`

A linter over `content/blog/**/*.md` reporting: ban-list hits, three-item-list
monotony, suspiciously uniform paragraph lengths, posts containing no proper
noun / no date / no number anywhere, and em-dash density. Advisory by default
with a `--strict` mode for CI — mirroring how `check-localization.mjs` already
behaves.

### `content/blog/authors.ts`

The public identity uses the owner-selected label `Admin`, a short first-person
bio, an optional photo and optional `sameAs` links. The same stable identity is
used in every language and in the post JSON-LD.

### Translation honesty

`originalLocale` and `translator` in frontmatter, surfaced in the UI ("Aus dem
Deutschen übersetzt von …"). If a translation was machine-drafted and then
human-edited, say so. Never publish an unedited machine translation — a large
share of this audience are native French speakers and will notice immediately.

### Process

Add the editorial standard to the PR checklist. Every post gets read by a human
before merge. That review gate is the entire reason for choosing file-based
authoring.

---

## Phase 5 — Community voices: consent, child safety, PII — BUILT

**Goal:** real families appear in the content without the blog undermining the
product's privacy promise.

**Status:** shipped, except one item that is deliberately not mine to write —
see below. `supabase/migrations/202608150001_blog_community_voice_consents.sql`,
`docs/blog-consent-and-withdrawal.md`, `scripts/lib/image-location.mjs`, and
five new rules in the voice check. 16 further tests.

### What is now checked mechanically

| Rule                      | Catches                                            |
| ------------------------- | -------------------------------------------------- |
| `street-address`          | a street name followed by a house number, DE/FR/EN |
| `child-institution`       | a named Kita, Grundschule, école, nursery          |
| `missing-consent`         | a block quote in a post with no `consentRef`       |
| `image-location-metadata` | a referenced photo still carrying GPS EXIF         |
| `missing-image`           | a referenced image that is not in `public/`        |

Run against a post that broke all five, the check reported all five with line
numbers. Run against a clean post: nothing.

### Three things worth recording

- **The schema refuses identifiable minors rather than flagging them.**
  `depicts_identifiable_minor` is constrained to `false`. There is no guardian
  permission that makes an identifiable child acceptable on this site, so it is
  a `check` constraint, not a column someone could set to `true`.
- **`array_length` would have silently broken the locales constraint.** It
  returns `NULL` for an empty array, and a `CHECK` evaluating to `NULL` passes —
  so `array_length(locales, 1) > 0` would have permitted consent covering no
  languages at all. The migration uses `cardinality()` and drops the `'{}'`
  default.
- **The EXIF scanner is hand-written and dependency-free.** It reads the JPEG
  APP1 and PNG `eXIf` blocks directly, so CI does not need `exiftool`
  installed. Tested against both endiannesses, PNG, truncated files and
  non-images — including a zero-length-segment case that would otherwise loop
  forever.

### Not done, deliberately

The privacy policy in `components/legal/legal-page.tsx` does not mention the
blog. Whether it must is a question for whoever advises Gestiona Tech on data
protection — the site names a controller and a supervisory authority, and the
wording of a published privacy notice is legal text, not something to guess at.
The migration registers a `blog_community_voices` processing activity and a
`blog_consent_review` retention policy to bring to that conversation.

**The migration has not been applied.** Run `npm run db:migrate` when you want
it live.

### Consent

- Written consent before any interview, quote or photo is published. Consent
  covers the specific post, the specific quote or photo, and the languages it
  will appear in.
- Store consent records **outside git** — a `blog_consents` table in Supabase,
  or signed PDFs in a private bucket — referenced from frontmatter by opaque id
  (`consentRef: c_7f2a…`). Names, emails and signatures must never land in the
  repository.

### Hard content rules, enforced in review

- No identifiable children: no child faces, no full names of minors, no school
  or Kita names.
- Adults: first name and city only, unless they explicitly ask for more.
- No street-level locations, ever. It contradicts `/child-safety` and
  `/community-guidelines`, and it would be indexed permanently.
- Photos: strip EXIF, GPS above all, before commit. Add the check to the lint
  script.

### Withdrawal

A documented process to unpublish a quote or photo on request, including
re-running IndexNow and, where needed, filing a Google removal request. Link it
from `/[locale]/privacy`.

The site already names a controller (Gestiona Tech) and a DPA contact — have
the existing legal copy reviewed for whether the blog needs its own mention.

---

## Phase 6 — Gates and tests — BUILT

**Status:** shipped. `features/blog/sitemap.ts` (extracted from `app/sitemap.ts`
so it can be tested), `tests/unit/blog-sitemap.test.ts`, `tests/e2e/blog.spec.ts`,
blog checks in `scripts/smoke-production.mjs`, and `blog:check` wired into
`npm run check`.

### Findings are now graded, and only harm blocks

Splitting severity was not in the original plan but matters more than the rest
of the phase. `BLOCKING_RULES` covers `street-address`, `child-institution`,
`missing-consent`, `image-location-metadata` and `missing-image` — things that
describe published harm. Everything else is advisory.

`npm run blog:check` exits 1 on any blocking finding and 0 otherwise;
`blog:check:strict` fails on advisory findings too. A release stopped by an
em-dash count teaches people to bypass the hook, which then also skips the rules
that protect somebody. Verified both ways: a post containing "Nikolausstraße 6"
exits 1; the current tree, whose only finding is the placeholder bio, exits 0.

### E2E that is honest on an empty repository

`tests/e2e/blog.spec.ts` covers index rendering in all three languages,
canonical and hreflang, RSS autodiscovery, feed content type and absolute URLs,
404 on an unknown slug, JSON-LD referencing the site graph, and the community →
blog link. The post-dependent test skips itself while `content/blog` is empty,
so the suite does not fail today for a reason that is not a defect. **7 passed,
1 skipped** on an empty blog; **8 passed** with fixture posts staged.

### A real bug this phase caught

`blogEntries()` memoised for the process lifetime, so a post added while
`next dev` was running stayed invisible until a restart — the index kept showing
its empty state. Found because the E2E post test skipped when it should have
run. The registry now re-reads in development and caches only in production.
Making authors restart a server to see their own draft is exactly the wrong
friction on the part of this project that is already slowest.

### The rest

- **Unit (vitest):** frontmatter parsing, locale availability, sitemap entry
  generation, RSS validity, JSON-LD shape, sanitizer behaviour.
- **E2E (playwright):** index renders posts newest-first; a post renders; a
  DE-only post 404s at `/en/blog/<slug>`; hreflang lists only existing locales;
  breadcrumb present.
- Add a `blog:check` script (voice lint plus content validation) and wire it
  into `npm run check` alongside `i18n:check`.
- `npm run i18n:check` must still pass — the new `blog.*` chrome keys need all
  three locales.
- Extend `scripts/smoke-production.mjs` to hit a known post URL and the feed.

---

## Phase 7 — Launch and cadence — HANDED OVER

**Status:** the code side is done and there is deliberately little of it. What
shipped: `scripts/new-blog-post.mjs` with `npm run blog:new`, six tests in
`tests/unit/blog-scaffold.test.mjs`, and `docs/blog-launch.md` — the full
checklist with exact commands.

### Editorial ownership

**The posts.** Writing remains a content-owner decision. Drafting can remove
friction, but the owner must approve the claims, voice and public byline before
publication.

**The submissions.** Search Console and Bing verification need accounts that
are not mine, and IndexNow is an outward-facing submission to a live index.
`docs/blog-launch.md` has the exact sequence.

### Drafts use the mechanism Phase 1 already had

`npm run blog:new -- <slug>` writes `content/blog/<slug>/de.md` dated
**2099-01-01**. Future-dated posts are already withheld from the build, so a
half-written draft sits in the repository without appearing anywhere and
publishing is one date edit. No new draft concept, no new flag.

The scaffold body is empty on purpose. Anything pre-written there would be the
first thing a reader sees and the last thing anyone remembers to delete.

### Verified

`tests/unit/blog-scaffold.test.mjs` runs the generated frontmatter back through
the real `parseFrontmatter`, so the scaffold cannot drift from the schema it
has to satisfy.

### Seed with three to five German posts

Write these **before** the code ships. The writing is the long pole, not the
implementation. Candidates that all pass the "only a human could know this"
test:

1. Why you are building Kinavela — the actual moment it started.
2. What you got wrong in the first onboarding design, and what families told you.
3. A practical piece: securing a Kita place as a Cameroonian family in Germany —
   real forms, real deadlines.
4. An interview with one family in Munich or Berlin (Phase 5 consent applies).
5. Ndolé, and what it costs to keep cooking it here.

### Submit

Google Search Console (verify the property, submit the sitemap, request
indexing on the blog index and each post), Bing Webmaster Tools, then
`npm run seo:indexnow`.

### Cadence

One real post every two weeks beats four thin ones a month. The blog's job is
to make kinavela.com something search engines and assistants have seen a human
write about — which is precisely what is missing today.

### Measure at 30 / 60 / 90 days

Indexed pages in Search Console, impressions on the brand query "kinavela",
referring domains.

---

## Sequencing

- **Phase 0** is closed and will not be built. Nothing depended on it.
- **Phases 1 → 2 → 3** are strictly ordered.
- **Phase 4 starts now**, in parallel with Phase 1. Writing is the bottleneck.
- **Phase 5** blocks community-voice posts, but not founder posts.
- **Phases 6 and 7** close it out.
