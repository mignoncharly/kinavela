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
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale, locales } from "@/lib/i18n/config";

type PageProps = { params: Promise<{ locale: string }> };
export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dictionary = getDictionary(locale);
  return {
    title: dictionary.meta.title,
    description: dictionary.meta.description,
    alternates: {
      canonical: `/${locale}`,
      languages: { de: "/de", fr: "/fr", en: "/en" },
    },
    openGraph: {
      type: "website",
      locale,
      title: dictionary.meta.title,
      description: dictionary.meta.description,
      siteName: "Kinavela",
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
    "@type": "Organization",
    name: "Kinavela",
    url: "https://kinavela.gestionatech.de",
    email: "info@gestionatech.de",
    description: dictionary.meta.description,
  };

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organizationJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <header className="site-header">
        <Link className="brand" href={`/${locale}`} aria-label="Kinavela home">
          <span className="brand-mark" aria-hidden="true">
            K
          </span>
          <span>KINAVELA</span>
        </Link>
        <nav className="desktop-nav" aria-label="Primary navigation">
          <a href="#vision">{dictionary.nav.vision}</a>
          <a href="#safety">{dictionary.nav.principles}</a>
          <a href="#contact">{dictionary.nav.contact}</a>
          <Link href={`/${locale}/auth/login`}>Sign in</Link>
        </nav>
        <nav className="locale-switcher" aria-label="Language selector">
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
          aria-label="Kinavela community journey illustration"
        >
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
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
              <small>12 km</small>
              <strong>Family nearby</strong>
            </span>
          </div>
          <div className="floating-card card-story">
            <span className="mini-icon green">
              <Sprout size={20} />
            </span>
            <span>
              <small>ROOTS PASSPORT</small>
              <strong>A story preserved</strong>
            </span>
          </div>
          <div className="dot dot-a" />
          <div className="dot dot-b" />
          <div className="dot dot-c" />
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
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="trust" id="safety" aria-labelledby="trust-title">
        <div className="trust-emblem" aria-hidden="true">
          <div className="emblem-ring">
            <LockKeyhole size={48} strokeWidth={1.4} />
          </div>
          <span>PRIVACY</span>
          <span>BY DESIGN</span>
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
        <p className="eyebrow">JOIN KINAVELA</p>
        <h2 id="cta-title">{dictionary.cta.title}</h2>
        <p>{dictionary.cta.body}</p>
        <a className="button button-primary" href={`/${locale}/auth/signup`}>
          {dictionary.cta.button}
          <ArrowRight size={18} aria-hidden="true" />
        </a>
      </section>

      <footer>
        <div className="brand footer-brand">
          <span className="brand-mark">K</span>
          <span>KINAVELA</span>
        </div>
        <p>
          <span className="status-dot" />
          {dictionary.footer.status}
        </p>
        <nav aria-label="Legal">
          <Link href={`/${locale}/privacy`}>Privacy</Link>{" "}
          <Link href={`/${locale}/terms`}>Terms</Link>{" "}
          <Link href={"/" + locale + "/impressum"}>Impressum</Link>{" "}
          <Link href={"/" + locale + "/cookies"}>Cookies</Link>{" "}
          <Link href={"/" + locale + "/child-safety"}>Child safety</Link>{" "}
          <Link href={"/" + locale + "/community-guidelines"}>Community</Link>{" "}
          <a href="mailto:info@gestionatech.de">Contact</a>
        </nav>
        <p>
          © {new Date().getUTCFullYear()} Kinavela. {dictionary.footer.rights}
        </p>
      </footer>
    </main>
  );
}
