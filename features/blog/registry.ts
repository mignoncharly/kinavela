import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { locales, type Locale } from "@/lib/i18n/config";
import { assertAuthorsResolve, assertCommunityLinksResolve } from "./authors";
import { parseFrontmatter } from "./frontmatter";
import { readingMinutes, renderMarkdown } from "./markdown";
import type { BlogEntry, BlogPost } from "./types";

export const BLOG_CONTENT_ROOT = join(process.cwd(), "content", "blog");

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function readDirectories(root: string) {
  let names: string[];
  try {
    names = readdirSync(root);
  } catch {
    // No content directory yet is a legitimate state, not a build failure.
    return [];
  }
  return names
    .filter((name) => !name.startsWith(".") && !name.startsWith("_"))
    .filter((name) => {
      try {
        return statSync(join(root, name)).isDirectory();
      } catch {
        return false;
      }
    })
    .sort();
}

function readPost(root: string, slug: string, locale: Locale): BlogPost | null {
  const path = join(root, slug, `${locale}.md`);
  let source: string;
  try {
    source = readFileSync(path, "utf8");
  } catch {
    return null;
  }

  const label = `content/blog/${slug}/${locale}.md`;
  const { frontmatter, body } = parseFrontmatter(source, label);

  if (frontmatter.translator && frontmatter.originalLocale === locale) {
    throw new Error(
      `${label}: translator is set but originalLocale is "${locale}" — a post cannot be a translation of itself`,
    );
  }

  return {
    ...frontmatter,
    slug,
    locale,
    html: renderMarkdown(body),
    readingMinutes: readingMinutes(body),
    translated: frontmatter.originalLocale !== locale,
  };
}

/**
 * Reads every post under `root`. Availability is derived purely from which
 * files exist, and posts dated in the future are withheld — which makes
 * scheduling a matter of setting a date rather than remembering to publish.
 */
export function loadBlogEntries(
  root: string = BLOG_CONTENT_ROOT,
  now: Date = new Date(),
): BlogEntry[] {
  const today = now.toISOString().slice(0, 10);
  const entries: BlogEntry[] = [];

  for (const slug of readDirectories(root)) {
    if (!SLUG_PATTERN.test(slug)) {
      throw new Error(
        `content/blog/${slug}: directory name is not a valid slug (lowercase, digits and single hyphens)`,
      );
    }

    const byLocale: Partial<Record<Locale, BlogPost>> = {};
    const availableLocales: Locale[] = [];
    const declaredOriginals = new Set<Locale>();

    for (const locale of locales) {
      const post = readPost(root, slug, locale);
      if (!post) continue;
      declaredOriginals.add(post.originalLocale);
      if (post.published > today) continue;
      byLocale[locale] = post;
      availableLocales.push(locale);
    }

    if (availableLocales.length === 0) continue;

    if (declaredOriginals.size > 1) {
      throw new Error(
        `content/blog/${slug}: files disagree about originalLocale (${[...declaredOriginals].sort().join(", ")})`,
      );
    }

    const [firstLocale] = availableLocales;
    const originalLocale =
      [...declaredOriginals][0] ?? firstLocale ?? locales[0];

    entries.push({ slug, originalLocale, availableLocales, byLocale });
  }

  return entries.sort((a, b) => {
    const left = a.byLocale[a.availableLocales[0] ?? a.originalLocale];
    const right = b.byLocale[b.availableLocales[0] ?? b.originalLocale];
    return (right?.published ?? "").localeCompare(left?.published ?? "");
  });
}

let cached: BlogEntry[] | null = null;

function loadAndVerify(): BlogEntry[] {
  const entries = loadBlogEntries();
  assertAuthorsResolve(entries);
  assertCommunityLinksResolve(entries);
  return entries;
}

/**
 * Parsed once per server process in production — never per request.
 *
 * Development re-reads every time: the cache is process-lifetime, so a post
 * added while `next dev` is running would otherwise stay invisible until a
 * restart, with the index still showing its empty state. Writing is the slow
 * part of this project; making authors restart a server to see their own draft
 * is exactly the wrong friction to add.
 */
export function blogEntries(): BlogEntry[] {
  if (process.env.NODE_ENV === "development") return loadAndVerify();
  cached ??= loadAndVerify();
  return cached;
}

export function listBlogPosts(
  locale: Locale,
  entries: BlogEntry[] = blogEntries(),
): BlogPost[] {
  return entries
    .map((entry) => entry.byLocale[locale])
    .filter((post): post is BlogPost => post !== undefined)
    .sort((a, b) => b.published.localeCompare(a.published));
}

export function getBlogPost(
  slug: string,
  locale: Locale,
  entries: BlogEntry[] = blogEntries(),
): BlogPost | undefined {
  return entries.find((entry) => entry.slug === slug)?.byLocale[locale];
}

/** The locales a post actually exists in — the source of truth for hreflang. */
export function blogPostLocales(
  slug: string,
  entries: BlogEntry[] = blogEntries(),
): Locale[] {
  return entries.find((entry) => entry.slug === slug)?.availableLocales ?? [];
}

export type BlogIndexItem = {
  post: BlogPost;
  /** The language the shown post is actually written in. */
  locale: Locale;
  /** True when the reader's language has no version of this post yet. */
  fallback: boolean;
};

/**
 * The index shows every post, including ones not yet translated into the
 * reader's language — those appear in their original language and are labelled
 * as such. Hiding them would cost more than it protects: this audience reads
 * more than one of these three languages.
 */
export function blogIndex(
  locale: Locale,
  entries: BlogEntry[] = blogEntries(),
): BlogIndexItem[] {
  const items: BlogIndexItem[] = [];

  for (const entry of entries) {
    const preferred = entry.byLocale[locale];
    if (preferred) {
      items.push({ post: preferred, locale, fallback: false });
      continue;
    }
    const fallbackLocale =
      entry.availableLocales.find((item) => item === entry.originalLocale) ??
      entry.availableLocales[0];
    const post = fallbackLocale ? entry.byLocale[fallbackLocale] : undefined;
    if (post && fallbackLocale) {
      items.push({ post, locale: fallbackLocale, fallback: true });
    }
  }

  return items.sort((a, b) => b.post.published.localeCompare(a.post.published));
}
