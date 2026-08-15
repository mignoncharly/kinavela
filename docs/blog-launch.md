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

Choose one real family question per post. The title should name the question or
topic plainly, and the article should give enough context that a reader does
not have to search again for the basic answer. Good content pillars are:

1. **Family life in Germany:** Kita, Schule, Anmeldung and local services, with
   current links to the responsible public authority.
2. **Language and belonging:** practical family routines, specific words and
   first-hand experience rather than generic bilingual-parenting advice.
3. **Safe local connections:** how to evaluate a family network, arrange a first
   meeting and protect children’s information.
4. **Culture in everyday life:** recipes, names, stories, celebrations and what
   it actually takes to keep them present in Germany.
5. **Kinavela decisions:** what changed, why it changed and what the decision
   means for a family using the platform.

If a post quotes or photographs a family, read
`docs/blog-consent-and-withdrawal.md` before the conversation. Legal, health
and administrative guidance must cite a current primary source and state the
date it was checked.

Before each pull request:

```bash
npm run blog:check:strict
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

**Bing Webmaster Tools** — verify the same property and submit the same
sitemap. Use its AI Performance report to monitor citations across Bing and
Microsoft Copilot surfaces.

**Assistant search crawlers** — no separate submission is available. The live
`robots.txt` allows `OAI-SearchBot`, `Claude-SearchBot`, `Claude-User` and the
other retrieval crawlers while keeping member routes private. Recheck that a
public post returns HTTP 200 for those user agents after firewall or CDN
changes.

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

| Signal                                              | Where                                       |
| --------------------------------------------------- | ------------------------------------------- |
| Pages indexed                                       | Search Console → Pages                      |
| Impressions on the brand query “kinavela”           | Search Console → Performance                |
| Citations in Bing and Microsoft Copilot             | Bing Webmaster → AI Performance             |
| Visits from ChatGPT search                          | Analytics referral `utm_source=chatgpt.com` |
| Referring domains                                   | A backlink tool                             |
| Whether assistants answer accurately about Kinavela | Manual checks with cited sources            |

If Search Console reports posts as **Crawled — currently not indexed** at 60
days, the problem is content quality or authority, not plumbing. If it reports
**Discovered — currently not indexed**, it is queue time; wait.

---

## Current primary guidance

- [Google: helpful, reliable, people-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)
- [Google: generative AI features in Search](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)
- [Bing Webmaster Guidelines](https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a)
- [OpenAI publisher FAQ](https://help.openai.com/en/articles/12627856-publishers-and-developers-faq)
- [Anthropic crawler controls](https://support.anthropic.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler)
