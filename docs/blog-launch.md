# Launching the blog

The code is finished. What remains is writing, and then a short sequence of
submissions that only you can make — they need your Google and Bing accounts.

Nothing on this page is automated on purpose. Publishing is outward-facing and
irreversible in the sense that matters: once a post is indexed, it is quoted,
cached and summarised by systems you do not control.

---

## 1. Write

```bash
npm run blog:new -- warum-wir-kinavela-bauen
```

That creates `content/blog/<slug>/de.md`, dated **2099-01-01** so it stays out
of the build while you work. Publishing is one date edit.

Three to five German posts before launch is enough. Candidates that all pass
the "only a human here could know this" test in
`docs/blog-editorial-standard.md`:

1. Why you are building Kinavela — the actual moment it started.
2. What you got wrong in the first onboarding design, and what families told you.
3. Securing a Kita place as a Cameroonian family in Germany — real forms, real deadlines.
4. An interview with one family in Munich or Berlin. Phase 5 consent applies:
   read `docs/blog-consent-and-withdrawal.md` **before** the conversation, not
   after.
5. Ndolé, and what it costs to keep cooking it here.

Also rewrite your bio in `content/blog/authors.ts` and delete
`placeholderBio: true`. Until you do, `npm run blog:check` will keep saying so,
and it is right to.

Before each pull request:

```bash
npm run blog:check          # privacy findings block, style findings advise
```

---

## 2. Ship

```bash
npm run check               # format, i18n, blog, lint, types, tests, build
npm run db:migrate          # once, for kinavela_private.blog_consents
```

Then deploy as usual, and confirm the surface is real:

```bash
SMOKE_BASE_URL=https://www.kinavela.com npm run smoke:production
```

That asserts `/de/blog` renders with a canonical link and RSS autodiscovery,
`/de/feed.xml` is valid RSS with absolute URLs, every blog URL in the sitemap
resolves, and an unknown slug is a 404.

---

## 3. Submit

This is the part that fixes the problem you started with — that
`kinavela.com` returns nothing in search, so an assistant asked about it
correctly reports knowing nothing.

**Google Search Console** — verify `www.kinavela.com` if you have not already,
submit `https://www.kinavela.com/sitemap.xml`, then use URL Inspection →
_Request Indexing_ on:

- `https://www.kinavela.com/de`
- `https://www.kinavela.com/de/blog`
- each post URL

**Bing Webmaster Tools** — same property, same sitemap. Bing feeds ChatGPT
search, so this is a separate distribution channel rather than a duplicate.

**IndexNow** — already wired, nothing to build:

```bash
npm run seo:indexnow                        # everything in the sitemap
npm run seo:indexnow -- /de/blog/<slug>     # one post, after publishing it
```

Run it after each deploy that publishes or changes a post.

---

## 4. Build the entity, not just the pages

Indexing gets the pages found. It does not, on its own, make an assistant
willing to say what Kinavela is — that comes from other sites referring to you.

- A LinkedIn company page and an Instagram or Facebook profile, each linking to
  `https://www.kinavela.com`.
- Listings in German diaspora and family directories.
- Once those exist, add them to `sameAs` in `content/blog/authors.ts` and
  consider an Organization-level `sameAs` on the homepage graph. The structured
  data already claims an identity; `sameAs` is what corroborates it.

---

## 5. Cadence

One real post every two weeks beats four thin ones a month. Thin posts are
worse than no posts: they are exactly what the editorial standard exists to
prevent, and they teach a search engine that the site is filler.

If a fortnight passes and there is nothing true to say, say nothing.

---

## 6. Measure

Check at 30, 60 and 90 days:

| Signal                                             | Where                        |
| -------------------------------------------------- | ---------------------------- |
| Pages indexed                                      | Search Console → Pages       |
| Impressions on the brand query "kinavela"          | Search Console → Performance |
| Referring domains                                  | any backlink tool            |
| Whether an assistant can now answer "kinavela.com" | ask one                      |

If Search Console reports posts as **Crawled — currently not indexed** at 60
days, the problem is content quality or authority, not plumbing. If it reports
**Discovered — currently not indexed**, it is queue time; wait.
