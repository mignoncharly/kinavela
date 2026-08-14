import Link from "next/link";
import type { Metadata } from "next";

import { legalCopy, type LegalCopy } from "@/components/legal/legal-copy";
import { MetricsConsentSettings } from "@/components/privacy/metrics-consent-settings";
import type { Locale } from "@/lib/i18n/config";

export type LegalKind =
  | "privacy"
  | "terms"
  | "impressum"
  | "cookies"
  | "child-safety"
  | "community-guidelines";

export function legalMetadata(locale: Locale, kind: LegalKind): Metadata {
  const copy = legalCopy[locale];
  return {
    title: copy.labels[kind],
    description: copy.documents[kind].intro,
    alternates: { canonical: `/${locale}/${kind}` },
  };
}

const contact = {
  info: "contact@kinavela.com",
  privacy: "privacy@kinavela.com",
  authority: "poststelle@datenschutz.rlp.de",
} as const;

function InlineText({ children }: { children: string }) {
  const tokens = children.split(/(\{\{(?:privacy|info|authority)\}\})/);
  return tokens.map((token, index) => {
    const key = token.slice(2, -2) as keyof typeof contact;
    if (!(key in contact)) return token;
    const email = contact[key];
    return (
      <a href={`mailto:${email}`} key={`${key}-${index}`}>
        {email}
      </a>
    );
  });
}

function ControllerContact({ copy }: { copy: LegalCopy["controller"] }) {
  return (
    <address>
      <strong>Gestiona Tech – Nguenkam Charles</strong>
      <br />
      {copy.legalForm}
      <br />
      Nikolausstraße 6
      <br />
      55120 Mainz, Deutschland
      <br />
      {copy.email}: <a href="mailto:contact@kinavela.com">{contact.info}</a>
    </address>
  );
}

function LegalNavigation({
  copy,
  locale,
}: {
  copy: LegalCopy;
  locale: Locale;
}) {
  const links = (Object.keys(copy.labels) as LegalKind[]).map((kind) => [
    kind,
    copy.labels[kind],
  ]);

  return (
    <nav className="legal-navigation" aria-label={copy.navigationLabel}>
      {links.map(([kind, label]) => (
        <Link href={`/${locale}/${kind}`} key={kind}>
          {label}
        </Link>
      ))}
    </nav>
  );
}

function Document({
  document,
}: {
  document: LegalCopy["documents"][LegalKind];
}) {
  return (
    <>
      {document.intro && (
        <p>
          <InlineText>{document.intro}</InlineText>
        </p>
      )}
      {document.sections.map((section, index) => (
        <section key={`${section.title ?? "section"}-${index}`}>
          {section.title && <h2>{section.title}</h2>}
          {section.paragraphs?.map((paragraph, paragraphIndex) => (
            <p key={paragraphIndex}>
              <InlineText>{paragraph}</InlineText>
            </p>
          ))}
          {section.bullets && (
            <ul>
              {section.bullets.map((item, itemIndex) => (
                <li key={itemIndex}>
                  <InlineText>{item}</InlineText>
                </li>
              ))}
            </ul>
          )}
          {section.table && (
            <table>
              <thead>
                <tr>
                  {section.table.headers.map((header) => (
                    <th key={header}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {section.table.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex}>
                        <InlineText>{cell}</InlineText>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ))}
    </>
  );
}

export function LegalPage({
  locale,
  kind,
}: {
  locale: Locale;
  kind: LegalKind;
}) {
  const copy = legalCopy[locale];
  const document = copy.documents[kind];

  return (
    <main className="legal-page">
      <Link className="brand" href={`/${locale}`}>
        <span className="brand-mark">K</span>KINAVELA
      </Link>
      <p className="eyebrow">{copy.eyebrow}</p>
      <h1>{copy.labels[kind]}</h1>
      <p className="legal-meta">{copy.meta}</p>
      {kind === "privacy" ||
        (kind === "impressum" && <ControllerContact copy={copy.controller} />)}
      <Document document={document} />
      {kind === "cookies" && <MetricsConsentSettings locale={locale} />}
      <LegalNavigation copy={copy} locale={locale} />
      <p>
        <strong>{copy.generalContact}</strong>{" "}
        <a href="mailto:contact@kinavela.com">{contact.info}</a>
      </p>
    </main>
  );
}
