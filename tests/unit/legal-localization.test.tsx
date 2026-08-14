import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  LegalPage,
  legalMetadata,
  type LegalKind,
} from "@/components/legal/legal-page";
import { legalCopy } from "@/components/legal/legal-copy";
import { locales } from "@/lib/i18n/config";
import SuspendedPage from "@/app/[locale]/suspended/page";

afterEach(cleanup);

const documents: Array<{
  kind: LegalKind;
  de: string;
  fr: string;
  en: string;
}> = [
  {
    kind: "privacy",
    de: "Datenschutzerklärung",
    fr: "Politique de confidentialité",
    en: "Privacy policy",
  },
  {
    kind: "terms",
    de: "Nutzungsbedingungen",
    fr: "Conditions d’utilisation",
    en: "Terms of service",
  },
  {
    kind: "impressum",
    de: "Impressum",
    fr: "Mentions légales",
    en: "Impressum",
  },
  {
    kind: "cookies",
    de: "Cookie- und Browser-Speicher-Richtlinie",
    fr: "Politique relative aux cookies et au stockage du navigateur",
    en: "Cookie and browser-storage policy",
  },
  {
    kind: "child-safety",
    de: "Kinderschutzrichtlinie",
    fr: "Politique de protection de l’enfance",
    en: "Child safety policy",
  },
  {
    kind: "community-guidelines",
    de: "Community-Regeln",
    fr: "Règles de la communauté",
    en: "Community guidelines",
  },
];

describe("Localization Phase L1 legal and safety pages", () => {
  it("provides content for every legal document in every locale", () => {
    for (const locale of locales) {
      const copy = legalCopy[locale];
      for (const document of documents) {
        expect(copy.labels[document.kind].trim()).not.toBe("");
        const content = copy.documents[document.kind];
        expect(content.sections.length).toBeGreaterThan(0);
        for (const section of content.sections) {
          expect(
            Boolean(
              section.title ||
              section.paragraphs?.some((value) => value.trim()) ||
              section.bullets?.some((value) => value.trim()) ||
              section.table,
            ),
          ).toBe(true);
          for (const paragraph of section.paragraphs ?? [])
            expect(paragraph.trim()).not.toBe("");
          for (const bullet of section.bullets ?? [])
            expect(bullet.trim()).not.toBe("");
          for (const row of section.table?.rows ?? [])
            for (const cell of row) expect(cell.trim()).not.toBe("");
        }
      }
    }
  });

  it.each(documents)(
    "renders $kind with complete German framing",
    ({ kind, de }) => {
      render(<LegalPage kind={kind} locale="de" />);
      expect(screen.getByRole("heading", { level: 1, name: de })).toBeVisible();
      expect(
        screen.getByRole("navigation", { name: "Rechtliche Dokumente" }),
      ).toBeVisible();
    },
  );

  it.each(documents)(
    "renders $kind with complete French framing",
    ({ kind, fr }) => {
      render(<LegalPage kind={kind} locale="fr" />);
      expect(screen.getByRole("heading", { level: 1, name: fr })).toBeVisible();
      expect(
        screen.getByRole("navigation", { name: "Documents juridiques" }),
      ).toBeVisible();
    },
  );

  it.each(documents)(
    "retains the English legal document for $kind",
    ({ kind, en }) => {
      render(<LegalPage kind={kind} locale="en" />);
      expect(screen.getByRole("heading", { level: 1, name: en })).toBeVisible();
    },
  );

  it("localizes the suspended-account explanation", async () => {
    render(await SuspendedPage({ params: Promise.resolve({ locale: "fr" }) }));
    expect(
      screen.getByRole("heading", {
        name: "Compte temporairement indisponible",
      }),
    ).toBeVisible();
    expect(screen.getByText("Retourner à Kinavela")).toBeVisible();
  });

  it("generates localized legal metadata", () => {
    expect(legalMetadata("de", "privacy").title).toBe("Datenschutzerklärung");
    expect(legalMetadata("fr", "child-safety").title).toBe(
      "Politique de protection de l’enfance",
    );
    expect(legalMetadata("en", "terms").description).toContain(
      "These Terms govern Kinavela",
    );
  });
});
