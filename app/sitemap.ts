import type { MetadataRoute } from "next";

import { blogEntries } from "@/features/blog/registry";
import { blogSitemapEntries } from "@/features/blog/sitemap";
import { publicCommunityPages } from "@/features/seo/public-pages";
import { locales } from "@/lib/i18n/config";

const baseUrl = "https://www.kinavela.com";
const defaultLocale = "de";
const legalRoutes = [
  "privacy",
  "terms",
  "impressum",
  "cookies",
  "child-safety",
  "community-guidelines",
];

// Sitemap hreflang annotations must be fully-qualified: unlike the <link> tags
// in page metadata, Next does not resolve these against metadataBase, and
// search engines discard relative hrefs.
function alternatesFor(path: string) {
  return {
    languages: {
      ...Object.fromEntries(
        locales.map((locale) => [locale, `${baseUrl}/${locale}${path}`]),
      ),
      "x-default": `${baseUrl}/${defaultLocale}${path}`,
    },
  };
}

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date("2026-08-11T00:00:00Z");
  return [
    ...locales.map((locale) => ({
      url: `${baseUrl}/${locale}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: locale === defaultLocale ? 1 : 0.8,
      alternates: alternatesFor(""),
    })),
    ...locales.flatMap((locale) =>
      publicCommunityPages.map((page) => ({
        url: `${baseUrl}/${locale}/community/${page.slug}`,
        lastModified,
        changeFrequency: "weekly" as const,
        priority: 0.7,
        alternates: alternatesFor(`/community/${page.slug}`),
      })),
    ),
    ...blogSitemapEntries(blogEntries(), lastModified),
    ...locales.flatMap((locale) =>
      legalRoutes.map((route) => ({
        url: `${baseUrl}/${locale}/${route}`,
        lastModified,
        changeFrequency: "yearly" as const,
        priority: 0.3,
        alternates: alternatesFor(`/${route}`),
      })),
    ),
  ];
}
