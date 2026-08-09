import type { MetadataRoute } from "next";

import { locales } from "@/lib/i18n/config";

export default function sitemap(): MetadataRoute.Sitemap {
  return locales.map((locale) => ({
    url: `https://kinavela.gestionatech.de/${locale}`,
    lastModified: new Date("2026-08-09T00:00:00Z"),
    changeFrequency: "monthly",
    priority: locale === "de" ? 1 : 0.8,
    alternates: {
      languages: { de: "/de", fr: "/fr", en: "/en" },
    },
  }));
}
