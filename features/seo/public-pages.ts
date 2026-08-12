import type { Locale } from "@/lib/i18n/config";

export const publicCommunityPages = [
  {
    slug: "cameroonian-families-in-germany",
    cityLabel: "Germany",
    title: {
      de: "Kamerunische Familien in Deutschland",
      fr: "Familles camerounaises en Allemagne",
      en: "Cameroonian families in Germany",
    },
  },
  {
    slug: "cameroonian-families-in-munich",
    cityLabel: "Munich",
    title: {
      de: "Kamerunische Familien in München",
      fr: "Familles camerounaises à Munich",
      en: "Cameroonian families in Munich",
    },
  },
  {
    slug: "cameroonian-families-in-berlin",
    cityLabel: "Berlin",
    title: {
      de: "Kamerunische Familien in Berlin",
      fr: "Familles camerounaises à Berlin",
      en: "Cameroonian families in Berlin",
    },
  },
  {
    slug: "cameroonian-families-in-frankfurt",
    cityLabel: "Frankfurt",
    title: {
      de: "Kamerunische Familien in Frankfurt",
      fr: "Familles camerounaises à Francfort",
      en: "Cameroonian families in Frankfurt",
    },
  },
  {
    slug: "cameroonian-families-near-ingolstadt",
    cityLabel: "Ingolstadt",
    title: {
      de: "Kamerunische Familien nahe Ingolstadt",
      fr: "Familles camerounaises près d’Ingolstadt",
      en: "Cameroonian families near Ingolstadt",
    },
  },
] as const;

export type PublicCommunityPage = (typeof publicCommunityPages)[number];

export function getPublicCommunityPage(slug: string) {
  return publicCommunityPages.find((page) => page.slug === slug);
}

export function localizedCommunityTitle(
  page: PublicCommunityPage,
  locale: Locale,
) {
  return page.title[locale];
}
