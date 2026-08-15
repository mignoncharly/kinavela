import type { Locale } from "@/lib/i18n/config";

/**
 * hreflang for a post lists only the languages it actually exists in, and
 * x-default points at the language it was written in rather than at the site
 * default. Announcing a translation that has not been written yet would send
 * readers and crawlers to a 404, which is worse than announcing nothing.
 */
export function blogPostLanguageAlternates(
  slug: string,
  available: Locale[],
  originalLocale: Locale,
): Record<string, string> {
  const languages = Object.fromEntries(
    available.map((locale) => [locale, `/${locale}/blog/${slug}`]),
  );
  // The original may itself be unpublished (future-dated) while a translation
  // is live, so x-default falls back to something that certainly resolves.
  const defaultLocale = available.includes(originalLocale)
    ? originalLocale
    : available[0];
  return defaultLocale
    ? { ...languages, "x-default": `/${defaultLocale}/blog/${slug}` }
    : languages;
}
