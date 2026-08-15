import {
  ArrowDownRight,
  ArrowRight,
  Check,
  HeartHandshake,
  Languages,
  LockKeyhole,
  MapPin,
  Sprout,
} from "lucide-react";
import type { Metadata, ResolvingMetadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { JourneyScene } from "@/components/landing/journey-scene";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale, locales } from "@/lib/i18n/config";

type PageProps = { params: Promise<{ locale: string }> };
export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata(
  { params }: PageProps,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dictionary = getDictionary(locale);
  // openGraph is shallow-merged: defining it here drops the root segment's
  // opengraph-image, so carry the parent's images through explicitly.
  const parentImages = (await parent).openGraph?.images ?? [];
  return {
    // meta.title already carries the brand, so bypass the "%s · Kinavela"
    // template instead of rendering "Kinavela — … · Kinavela".
    title: { absolute: dictionary.meta.title },
    description: dictionary.meta.description,
    alternates: {
      canonical: `/${locale}`,
      languages: { de: "/de", fr: "/fr", en: "/en", "x-default": "/de" },
    },
    openGraph: {
      type: "website",
      locale,
      url: `/${locale}`,
      title: dictionary.meta.title,
      description: dictionary.meta.description,
      siteName: "Kinavela",
      images: parentImages,
    },
  };
}

const journeyIcons = [MapPin, HeartHandshake, Sprout, Languages];

export default async function LandingPage({ params }: PageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dictionary = getDictionary(locale);

  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://www.kinavela.com/#organization",
        name: "Kinavela",
        url: "https://www.kinavela.com",
        email: "contact@kinavela.com",
        logo: "https://www.kinavela.com/icon.svg",
        description: dictionary.meta.description,
      },
      {
        "@type": "WebSite",
        "@id": "https://www.kinavela.com/#website",
        url: "https://www.kinavela.com",
        name: "Kinavela",
        inLanguage: locale,
        publisher: { "@id": "https://www.kinavela.com/#organization" },
      },
    ],
  };

  return (
    <main className="landing-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organizationJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <header className="site-header">
        <Link
          className="brand"
          href={`/${locale}`}
          aria-label={dictionary.nav.homeLabel}
        >
          <span className="brand-mark" aria-hidden="true">
            K
          </span>
          <span>KINAVELA</span>
        </Link>
        <nav className="desktop-nav" aria-label={dictionary.nav.primaryLabel}>
          <a href="#vision">{dictionary.nav.vision}</a>
          <a href="#safety">{dictionary.nav.principles}</a>
          <Link className="nav-blog" href={`/${locale}/blog`}>
            {dictionary.nav.blog}
          </Link>
          <a href="#contact">{dictionary.nav.contact}</a>
          <Link href={`/${locale}/auth/login`}>{dictionary.nav.signIn}</Link>
        </nav>
        <nav
          className="locale-switcher"
          aria-label={dictionary.nav.languageLabel}
        >
          {locales.map((item) => (
            <Link
              key={item}
              href={`/${item}`}
              hrefLang={item}
              aria-current={item === locale ? "page" : undefined}
            >
              {item.toUpperCase()}
            </Link>
          ))}
        </nav>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">{dictionary.hero.eyebrow}</p>
          <h1 id="hero-title">{dictionary.hero.title}</h1>
          <p className="hero-body">{dictionary.hero.body}</p>
          <div className="hero-actions">
            <a
              className="button button-primary"
              href={`/${locale}/auth/signup`}
            >
              {dictionary.hero.primary}
              <ArrowRight size={18} aria-hidden="true" />
            </a>
            <a className="button button-secondary" href="#vision">
              {dictionary.hero.secondary}
              <ArrowDownRight size={18} aria-hidden="true" />
            </a>
          </div>
          <p className="privacy-line">
            <LockKeyhole size={16} aria-hidden="true" />
            {dictionary.hero.privacy}
          </p>
        </div>
        <div
          className="hero-visual"
          role="img"
          aria-label={dictionary.hero.illustrationLabel}
        >
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="community-scene" aria-hidden="true">
            <span className="scene-sun" />
            <span className="scene-home scene-home-left" />
            <span className="scene-home scene-home-right" />
            <span className="scene-tree scene-tree-left" />
            <span className="scene-tree scene-tree-right" />
            <span className="scene-person scene-person-one" />
            <span className="scene-person scene-person-two" />
            <span className="scene-person scene-person-three" />
            <span className="scene-person scene-person-four" />
            <span className="scene-path" />
            <HeartHandshake
              className="scene-heart"
              size={28}
              strokeWidth={1.6}
            />
          </div>
          <div className="sun-disc">
            <span>ROOTS</span>
            <strong>×</strong>
            <span>VILLAGE</span>
          </div>
          <div className="floating-card card-family">
            <span className="mini-icon warm">
              <HeartHandshake size={20} />
            </span>
            <span>
              <small>{dictionary.hero.nearbyDistance}</small>
              <strong>{dictionary.hero.nearbyFamily}</strong>
            </span>
          </div>
          <div className="floating-card card-story">
            <span className="mini-icon green">
              <Sprout size={20} />
            </span>
            <span>
              <small>{dictionary.hero.passportLabel}</small>
              <strong>{dictionary.hero.preservedStory}</strong>
            </span>
          </div>
          <div className="dot dot-a" />
          <div className="dot dot-b" />
          <div className="dot dot-c" />
          <div className="leaf-sprig leaf-sprig-one" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="leaf-sprig leaf-sprig-two" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>
      </section>

      <section className="journey" id="vision" aria-labelledby="journey-title">
        <div className="section-heading">
          <p className="eyebrow">{dictionary.journey.eyebrow}</p>
          <h2 id="journey-title">{dictionary.journey.title}</h2>
        </div>
        <div className="journey-grid">
          {dictionary.journey.steps.map((step, index) => {
            const Icon = journeyIcons[index] ?? Sprout;
            return (
              <article className="journey-card" key={step.number}>
                <div className="card-topline">
                  <span className="journey-icon">
                    <Icon size={22} aria-hidden="true" />
                  </span>
                  <span className="step-number">{step.number}</span>
                </div>
                <JourneyScene index={index} />
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="trust" id="safety" aria-labelledby="trust-title">
        <div className="trust-emblem" aria-hidden="true">
          <div className="trust-faces">
            <span />
            <span />
            <span />
          </div>
          <div className="emblem-ring">
            <LockKeyhole size={48} strokeWidth={1.4} />
          </div>
          <span>{dictionary.trust.emblem[0]}</span>
          <span>{dictionary.trust.emblem[1]}</span>
        </div>
        <div className="trust-copy">
          <p className="eyebrow light">{dictionary.trust.eyebrow}</p>
          <h2 id="trust-title">{dictionary.trust.title}</h2>
          <p>{dictionary.trust.body}</p>
          <ul>
            {dictionary.trust.items.map((item) => (
              <li key={item}>
                <span>
                  <Check size={16} aria-hidden="true" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="cta" id="contact" aria-labelledby="cta-title">
        <div className="cta-community" aria-hidden="true">
          <span />
          <span />
          <span />
          <HeartHandshake size={24} strokeWidth={1.7} />
          <span />
          <span />
        </div>
        <p className="eyebrow">{dictionary.cta.eyebrow}</p>
        <h2 id="cta-title">{dictionary.cta.title}</h2>
        <p>{dictionary.cta.body}</p>
        <a className="button button-primary" href={`/${locale}/auth/signup`}>
          {dictionary.cta.button}
          <ArrowRight size={18} aria-hidden="true" />
        </a>
      </section>

      <footer className="site-footer">
        <div className="site-footer-intro">
          <Link
            className="brand footer-brand"
            href={`/${locale}`}
            aria-label={dictionary.nav.homeLabel}
          >
            <span className="brand-mark" aria-hidden="true">
              K
            </span>
            <span>KINAVELA</span>
          </Link>
          <p className="site-footer-status">
            <span className="status-dot" aria-hidden="true" />
            {dictionary.footer.status}
          </p>
        </div>
        <nav
          className="site-footer-links"
          aria-label={dictionary.footer.legalLabel}
        >
          <Link href={`/${locale}/blog`}>{dictionary.nav.blog}</Link>
          <Link href={`/${locale}/privacy`}>{dictionary.footer.privacy}</Link>
          <Link href={`/${locale}/terms`}>{dictionary.footer.terms}</Link>
          <Link href={`/${locale}/impressum`}>
            {dictionary.footer.impressum}
          </Link>
          <Link href={`/${locale}/cookies`}>{dictionary.footer.cookies}</Link>
          <Link href={`/${locale}/child-safety`}>
            {dictionary.footer.childSafety}
          </Link>
          <Link href={`/${locale}/community-guidelines`}>
            {dictionary.footer.community}
          </Link>
          <a href="mailto:contact@kinavela.com">{dictionary.footer.contact}</a>
        </nav>
        <p className="site-footer-copyright">
          © {new Date().getUTCFullYear()} Kinavela. {dictionary.footer.rights}
        </p>
      </footer>
    </main>
  );
}
