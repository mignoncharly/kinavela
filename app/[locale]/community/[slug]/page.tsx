import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getPublicCommunityPage,
  localizedCommunityTitle,
  publicCommunityPages,
} from "@/features/seo/public-pages";
import { isLocale, locales, type Locale } from "@/lib/i18n/config";
import { createClient } from "@/lib/supabase/server";
import { publicCommunityAggregateSchema } from "@/lib/validation/seo";

type PageProps = { params: Promise<{ locale: string; slug: string }> };

export const dynamicParams = false;
export const revalidate = 3600;

export function generateStaticParams() {
  return locales.flatMap((locale) =>
    publicCommunityPages.map((page) => ({ locale, slug: page.slug })),
  );
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const page = getPublicCommunityPage(slug);
  if (!page || !isLocale(locale)) return {};
  const title = localizedCommunityTitle(page, locale);
  const description =
    locale === "de"
      ? `Aggregierte, datensparsame Informationen über die kamerunische Familiengemeinschaft in ${page.cityLabel}.`
      : locale === "fr"
        ? `Informations agrégées et respectueuses de la vie privée sur les familles camerounaises à ${page.cityLabel}.`
        : `Privacy-safe, aggregated information about the Cameroonian family community in ${page.cityLabel}.`;
  return {
    title,
    description,
    alternates: {
      canonical: `/${locale}/community/${slug}`,
      languages: Object.fromEntries(
        locales.map((item) => [item, `/${item}/community/${slug}`]),
      ),
    },
    openGraph: { type: "website", title, description, siteName: "Kinavela" },
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
  const content = copy(locale, page.cityLabel);
  const stats = aggregate.data;

  return (
    <main className="public-community-page">
      <header className="public-community-header">
        <Link className="brand" href={`/${locale}`}>
          <span className="brand-mark">K</span>
          <span>KINAVELA</span>
        </Link>
        <nav aria-label="Public navigation">
          <Link href={`/${locale}`}>{content.explore}</Link>
          <Link href={`/${locale}/privacy`}>Privacy</Link>
        </nav>
      </header>
      <article className="public-community-content">
        <p className="eyebrow">{content.eyebrow}</p>
        <h1>{localizedCommunityTitle(page, locale)}</h1>
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
            <h2>Community is forming</h2>
            <p>{content.forming}</p>
          </section>
        )}
        <Link className="button button-primary" href={`/${locale}/auth/signup`}>
          {content.explore}
        </Link>
      </article>
      <footer className="public-community-footer">
        <span>© {new Date().getUTCFullYear()} Kinavela</span>
        <span>Privacy by design · Aggregates only</span>
      </footer>
    </main>
  );
}
