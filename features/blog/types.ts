import type { Locale } from "@/lib/i18n/config";

/**
 * A named human being. Posts are attributed to one of these, never to the
 * brand: a real byline with a real bio is the strongest signal that a person
 * wrote the piece, and it is what Article/Person structured data needs.
 */
export type BlogAuthor = {
  key: string;
  name: string;
  /** Short role line, per locale. */
  role: Record<Locale, string>;
  /** First-person bio, per locale. Written by the author, not about them. */
  bio: Record<Locale, string>;
  /** Path under /public, or null while the author has no portrait. */
  image: string | null;
  /** Profile URLs that corroborate the person exists. Feeds Person.sameAs. */
  sameAs: string[];
  /**
   * Set while the bio is still the shipped placeholder rather than the
   * author's own words. `scripts/check-blog-voice.mjs` reports it, so the
   * rewrite stays a tracked task instead of a comment nobody reads. Delete the
   * flag when you have written your own.
   */
  placeholderBio?: boolean;
};

export type BlogFrontmatter = {
  title: string;
  excerpt: string;
  author: string;
  published: string;
  updated?: string;
  tags: string[];
  heroImage?: string;
  heroAlt?: string;
  originalLocale: Locale;
  translator?: string;
  consentRef?: string;
  community?: string;
};

/** One post in one language: frontmatter plus its rendered body. */
export type BlogPost = BlogFrontmatter & {
  slug: string;
  locale: Locale;
  html: string;
  readingMinutes: number;
  /** True when this file is a translation rather than the original writing. */
  translated: boolean;
};

/**
 * One post across every language it exists in. `availableLocales` is derived
 * from which files are on disk, so a post that has not been translated yet
 * simply has fewer entries — there is no list to keep in sync by hand.
 */
export type BlogEntry = {
  slug: string;
  originalLocale: Locale;
  availableLocales: Locale[];
  byLocale: Partial<Record<Locale, BlogPost>>;
};
