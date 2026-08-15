import type { Metadata, ResolvingMetadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getPublicCommunityPage,
  localizedCommunityCity,
  localizedCommunityTitle,
  publicCommunityPages,
} from "@/features/seo/public-pages";
import { isLocale, locales, type Locale } from "@/lib/i18n/config";
import { createClient } from "@/lib/supabase/server";
import { publicCommunityAggregateSchema } from "@/lib/validation/seo";

type PageProps = { params: Promise<{ locale: string; slug: string }> };

// This route cannot be prerendered, so it carries no `revalidate` or
// `dynamicParams`: both were declared here once and neither ever took effect.
// The root layout is `dynamic = "force-dynamic"` because proxy.ts issues a
// per-request CSP nonce, and Next can only stamp that nonce during a
// server-side render — a prerendered page would ship a nonce that never
// matches the response header, and `strict-dynamic` would then block every
// script on the page. Unknown slugs are already rejected by the notFound()
// below, so nothing depended on `dynamicParams = false` for correctness.
// generateStaticParams is kept for the day the public routes move off the
// nonce CSP; it is inert until then.
export function generateStaticParams() {
  return locales.flatMap((locale) =>
    publicCommunityPages.map((page) => ({ locale, slug: page.slug })),
  );
}

export async function generateMetadata(
  { params }: PageProps,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const { locale, slug } = await params;
  const page = getPublicCommunityPage(slug);
  if (!page || !isLocale(locale)) return {};
  // See app/[locale]/page.tsx — openGraph overwrites rather than merges.
  const parentImages = (await parent).openGraph?.images ?? [];
  const title = localizedCommunityTitle(page, locale);
  const city = localizedCommunityCity(page, locale);
  const description =
    locale === "de"
      ? `Aggregierte, datensparsame Informationen über die kamerunische Familiengemeinschaft in ${city}.`
      : locale === "fr"
        ? `Informations agrégées et respectueuses de la vie privée sur les familles camerounaises à ${city}.`
        : `Privacy-safe, aggregated information about the Cameroonian family community in ${city}.`;
  return {
    title,
    description,
    alternates: {
      canonical: `/${locale}/community/${slug}`,
      languages: {
        ...Object.fromEntries(
          locales.map((item) => [item, `/${item}/community/${slug}`]),
        ),
        "x-default": `/de/community/${slug}`,
      },
    },
    openGraph: {
      type: "website",
      locale,
      url: `/${locale}/community/${slug}`,
      title,
      description,
      siteName: "Kinavela",
      images: parentImages,
    },
  };
}

function copy(locale: Locale, city: string) {
  if (locale === "de") {
    return {
      eyebrow: "ÖFFENTLICHE GEMEINSCHAFTSINFORMATION",
      intro: `Kinavela unterstützt kamerunische Familien in ${city} dabei, kulturelle Wurzeln und vertrauensvolle Gemeinschaft zu pflegen.`,
      privacy:
        "Diese Seite zeigt ausschließlich geschützte, zusammengefasste Informationen. Familien, Kinder, Profile und genaue Orte werden niemals öffentlich angezeigt.",
      forming:
        "Die öffentliche Zusammenfassung wird sichtbar, sobald genügend Community-Aktivität für einen sinnvollen und datenschutzgerechten Überblick vorhanden ist.",
      available: "Aktuell verfügbar",
      families: "aktive Familien in der aggregierten Community",
      villages: "aktive Villages",
      events: "geplante öffentliche Aktivitäten",
      explore: "Kinavela kennenlernen",
      blogLink: "Blog",
      navigation: "Öffentliche Navigation",
      privacyLink: "Datenschutz",
      formingTitle: "Die Community entsteht",
      footer: "Datenschutz von Anfang an · Nur aggregierte Daten",
    };
  }
  if (locale === "fr") {
    return {
      eyebrow: "INFORMATIONS PUBLIQUES AGRÉGÉES",
      intro: `Kinavela aide les familles camerounaises à ${city} à préserver leurs racines et à créer une communauté de confiance.`,
      privacy:
        "Cette page présente uniquement des informations agrégées et protégées. Les familles, enfants, profils et lieux précis ne sont jamais publiés.",
      forming:
        "Le résumé public apparaîtra lorsqu’il y aura suffisamment d’activité communautaire pour fournir une vue utile et respectueuse de la vie privée.",
      available: "Disponible actuellement",
      families: "familles actives dans la communauté agrégée",
      villages: "Villages actifs",
      events: "activités publiques planifiées",
      explore: "Découvrir Kinavela",
      blogLink: "Blog",
      navigation: "Navigation publique",
      privacyLink: "Confidentialité",
      formingTitle: "La communauté se construit",
      footer: "Confidentialité dès la conception · Données agrégées uniquement",
    };
  }
  return {
    eyebrow: "AGGREGATED PUBLIC COMMUNITY INFORMATION",
    intro: `Kinavela helps Cameroonian families in ${city} preserve cultural roots and build trusted community.`,
    privacy:
      "This page contains only privacy-safe, aggregated information. Families, children, profiles and precise places are never published.",
    forming:
      "The public summary will appear once enough community activity exists to provide a useful, privacy-preserving overview.",
    available: "Currently available",
    families: "active families in the aggregated community",
    villages: "active Villages",
    events: "planned public activities",
    explore: "Explore Kinavela",
    blogLink: "Blog",
    navigation: "Public navigation",
    privacyLink: "Privacy",
    formingTitle: "Community is forming",
    footer: "Privacy by design · Aggregates only",
  };
}

export default async function CommunityPage({ params }: PageProps) {
  const { locale, slug } = await params;
  const page = getPublicCommunityPage(slug);
  if (!page || !isLocale(locale)) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_community_aggregate", {
    p_slug: page.slug,
  });
  const value = Array.isArray(data) ? data[0] : data;
  const aggregate = publicCommunityAggregateSchema.safeParse(value);
  if (error || !aggregate.success) notFound();
  const city = localizedCommunityCity(page, locale);
  const content = copy(locale, city);
  const stats = aggregate.data;
  const title = localizedCommunityTitle(page, locale);
  const pageUrl = `https://www.kinavela.com/${locale}/community/${page.slug}`;

  // Breadcrumbs give the page a labelled place in the site hierarchy, which is
  // what both Google's result trail and assistant citations read.
  const communityJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${pageUrl}#webpage`,
        url: pageUrl,
        name: title,
        inLanguage: locale,
        about: { "@type": "Place", name: city },
        isPartOf: { "@id": "https://www.kinavela.com/#website" },
        publisher: { "@id": "https://www.kinavela.com/#organization" },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Kinavela",
            item: `https://www.kinavela.com/${locale}`,
          },
          { "@type": "ListItem", position: 2, name: title, item: pageUrl },
        ],
      },
    ],
  };

  return (
    <main className="public-community-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(communityJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <header className="public-community-header">
        <Link className="brand" href={`/${locale}`}>
          <span className="brand-mark">K</span>
          <span>KINAVELA</span>
        </Link>
        <nav aria-label={content.navigation}>
          <Link href={`/${locale}`}>{content.explore}</Link>
          <Link href={`/${locale}/blog`}>{content.blogLink}</Link>
          <Link href={`/${locale}/privacy`}>{content.privacyLink}</Link>
        </nav>
      </header>
      <article className="public-community-content">
        <p className="eyebrow">{content.eyebrow}</p>
        <h1>{title}</h1>
        <p className="public-community-lead">{content.intro}</p>
        <p className="public-community-privacy">{content.privacy}</p>
        {stats.published ? (
          <section
            className="public-community-stats"
            aria-label={content.available}
          >
            <p className="eyebrow">{content.available}</p>
            <div className="public-community-stat-grid">
              <div>
                <strong>{stats.family_count}+</strong>
                <span>{content.families}</span>
              </div>
              {stats.village_count !== null && (
                <div>
                  <strong>{stats.village_count}+</strong>
                  <span>{content.villages}</span>
                </div>
              )}
              {stats.event_count !== null && (
                <div>
                  <strong>{stats.event_count}+</strong>
                  <span>{content.events}</span>
                </div>
              )}
            </div>
          </section>
        ) : (
          <section className="public-community-forming">
            <h2>{content.formingTitle}</h2>
            <p>{content.forming}</p>
          </section>
        )}
        <Link className="button button-primary" href={`/${locale}/auth/signup`}>
          {content.explore}
        </Link>
      </article>
      <footer className="public-community-footer">
        <span>© {new Date().getUTCFullYear()} Kinavela</span>
        <span>{content.footer}</span>
      </footer>
    </main>
  );
}
