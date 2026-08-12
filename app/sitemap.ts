import type { MetadataRoute } from "next";

import { publicCommunityPages } from "@/features/seo/public-pages";
import { locales } from "@/lib/i18n/config";

const baseUrl = "https://www.kinavela.com";
const legalRoutes = [
  "privacy",
  "terms",
  "impressum",
  "cookies",
  "child-safety",
  "community-guidelines",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [
    ...locales.map((locale) => ({
      url: baseUrl + "/" + locale,
      lastModified: new Date("2026-08-11T00:00:00Z"),
      changeFrequency: "monthly" as const,
      priority: locale === "de" ? 1 : 0.8,
      alternates: { languages: { de: "/de", fr: "/fr", en: "/en" } },
    })),
    ...locales.flatMap((locale) =>
      legalRoutes.map((route) => ({
        url: baseUrl + "/" + locale + "/" + route,
        lastModified: new Date("2026-08-11T00:00:00Z"),
        changeFrequency: "yearly" as const,
        priority: 0.5,
      })),
    ),
    ...locales.flatMap((locale) =>
      publicCommunityPages.map((page) => ({
        url: baseUrl + "/" + locale + "/community/" + page.slug,
        lastModified: new Date("2026-08-11T00:00:00Z"),
        changeFrequency: "weekly" as const,
        priority: 0.7,
        alternates: {
          languages: Object.fromEntries(
            locales.map((item) => [
              item,
              "/" + item + "/community/" + page.slug,
            ]),
          ),
        },
      })),
    ),
  ];
  return entries;
}
