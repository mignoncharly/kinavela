import { locales } from "@/lib/i18n/config";
import { SITE_URL } from "./site";
import type { BlogEntry } from "./types";

export type BlogSitemapEntry = {
  url: string;
  lastModified: Date;
  changeFrequency: "weekly" | "monthly";
  priority: number;
  alternates: { languages: Record<string, string> };
};

function asDate(day: string) {
  return new Date(`${day}T00:00:00Z`);
}

/** The most recent publish or update across every post, or null when empty. */
export function newestBlogDate(entries: BlogEntry[]): Date | null {
  const days = entries.flatMap((entry) =>
    entry.availableLocales.flatMap((locale) => {
      const post = entry.byLocale[locale];
      return post ? [post.updated ?? post.published] : [];
    }),
  );
  const newest = days.sort().at(-1);
  return newest ? asDate(newest) : null;
}

/**
 * Sitemap rows for the blog index in every language, plus one row per post per
 * language it actually exists in. Announcing a translation that has not been
 * written would put a 404 in the sitemap, which costs more than the missing
 * row would.
 */
export function blogSitemapEntries(
  entries: BlogEntry[],
  fallbackLastModified: Date,
): BlogSitemapEntry[] {
  const indexLastModified = newestBlogDate(entries) ?? fallbackLastModified;

  const indexRows = locales.map((locale) => ({
    url: `${SITE_URL}/${locale}/blog`,
    lastModified: indexLastModified,
    changeFrequency: "weekly" as const,
    priority: 0.8,
    alternates: {
      languages: {
        ...Object.fromEntries(
          locales.map((item) => [item, `${SITE_URL}/${item}/blog`]),
        ),
        "x-default": `${SITE_URL}/de/blog`,
      },
    },
  }));

  const postRows = entries.flatMap((entry) => {
    const languages = {
      ...Object.fromEntries(
        entry.availableLocales.map((item) => [
          item,
          `${SITE_URL}/${item}/blog/${entry.slug}`,
        ]),
      ),
      "x-default": `${SITE_URL}/${
        entry.availableLocales.includes(entry.originalLocale)
          ? entry.originalLocale
          : (entry.availableLocales[0] ?? entry.originalLocale)
      }/blog/${entry.slug}`,
    };

    return entry.availableLocales.flatMap((locale) => {
      const post = entry.byLocale[locale];
      if (!post) return [];
      return [
        {
          url: `${SITE_URL}/${locale}/blog/${entry.slug}`,
          lastModified: asDate(post.updated ?? post.published),
          changeFrequency: "monthly" as const,
          priority: 0.7,
          alternates: { languages },
        },
      ];
    });
  });

  return [...indexRows, ...postRows];
}
