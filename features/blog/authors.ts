import { blogAuthors } from "@/content/blog/authors";
import { publicCommunityPages } from "@/features/seo/public-pages";
import type { BlogAuthor, BlogEntry } from "./types";

export function getBlogAuthor(key: string): BlogAuthor | undefined {
  return (blogAuthors as Record<string, BlogAuthor>)[key];
}

export function blogAuthorKeys(): string[] {
  return Object.keys(blogAuthors);
}

/**
 * Every post must resolve to a real author. A byline pointing at a key that
 * does not exist would otherwise render as a blank name — the failure mode the
 * named-author rule exists to prevent — so it fails the load instead.
 */
export function assertAuthorsResolve(
  entries: BlogEntry[],
  knownKeys: string[] = blogAuthorKeys(),
) {
  const known = new Set(knownKeys);
  const unknown: string[] = [];

  for (const entry of entries) {
    for (const locale of entry.availableLocales) {
      const post = entry.byLocale[locale];
      if (post && !known.has(post.author)) {
        unknown.push(
          `content/blog/${entry.slug}/${locale}.md references unknown author "${post.author}"`,
        );
      }
    }
  }

  if (unknown.length > 0) {
    throw new Error(unknown.join("; "));
  }
}

/**
 * A post may point at a /community/<slug> page. Verifying the slug here means a
 * typo fails the load rather than shipping an internal link to a 404 — which
 * would waste exactly the crawl equity the cross-link exists to build.
 */
export function assertCommunityLinksResolve(
  entries: BlogEntry[],
  knownSlugs: string[] = publicCommunityPages.map((page) => page.slug),
) {
  const known = new Set(knownSlugs);
  const unknown: string[] = [];

  for (const entry of entries) {
    for (const locale of entry.availableLocales) {
      const post = entry.byLocale[locale];
      if (post?.community && !known.has(post.community)) {
        unknown.push(
          `content/blog/${entry.slug}/${locale}.md references unknown community page "${post.community}"`,
        );
      }
    }
  }

  if (unknown.length > 0) {
    throw new Error(unknown.join("; "));
  }
}
