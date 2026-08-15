# Writing a post

One directory per post, one file per language:

```
content/blog/
  warum-wir-kinavela-bauen/
    de.md          the original
    fr.md          added later, when a human has translated it
    en.md          may never exist — that is fine
```

The directory name is the URL slug: lowercase letters, digits and single
hyphens. A post appears in a language **only** when that language's file
exists — there is no index to update, and `/en/blog/<slug>` returns 404 for a
post that has not been translated yet.

## Frontmatter

```markdown
---
title: Warum wir Kinavela bauen
excerpt: Meine Tochter hat mich letzten Herbst gefragt, warum Oma anders spricht.
author: admin
published: 2026-08-20
originalLocale: de
tags: [familie, sprache]
---

Der Text beginnt hier.
```

| Key              | Required   | Notes                                                         |
| ---------------- | ---------- | ------------------------------------------------------------- |
| `title`          | yes        | 3–140 characters                                              |
| `excerpt`        | yes        | 20–300 characters; becomes the meta description               |
| `author`         | yes        | a key from `authors.ts`                                       |
| `published`      | yes        | `YYYY-MM-DD`; a future date withholds the post until that day |
| `updated`        | no         | `YYYY-MM-DD`; drives `lastmod` in the sitemap                 |
| `tags`           | no         | `[one, two]`, max 6, lowercase-hyphen                         |
| `heroImage`      | no         | path under `/public`                                          |
| `heroAlt`        | with image | required whenever `heroImage` is set                          |
| `originalLocale` | yes        | `de`, `fr` or `en` — the language it was actually written in  |
| `translator`     | no         | set only when someone other than the author translated it     |
| `consentRef`     | no         | `c_…` pointer to a consent record, for posts quoting a family |

Values are single-line. Wrap in quotes if the value would otherwise confuse the
parser. Anything the parser cannot read fails the build with the file and line
number — it will never guess.

## What the renderer allows

Markdown only. Raw HTML is dropped (its text survives), and links are limited
to `https:`, `http:`, `mailto:` and site-relative paths — anything else
degrades to plain text. A `#` heading in the body renders as `<h2>`, because
the page template owns the only `<h1>`.

## Before you commit

Read `docs/blog-editorial-standard.md`. The short version: every post must
contain at least one thing only a human at Kinavela could know.
