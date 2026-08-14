import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthPage } from "@/components/auth/auth-page";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { applicationDictionaries, getAppDictionary } from "@/lib/i18n/app-copy";
import { locales, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

afterEach(cleanup);

function leafPaths(value: unknown, prefix = ""): string[] {
  if (typeof value === "string") return [prefix];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      leafPaths(item, `${prefix}[${index}]`),
    );
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) =>
      leafPaths(item, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [];
}

function stringValues(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringValues);
  if (value && typeof value === "object") {
    return Object.values(value).flatMap(stringValues);
  }
  return [];
}

describe("application dictionary parity", () => {
  it("keeps identical application and landing dictionary shapes", () => {
    const appShape = leafPaths(applicationDictionaries.de);
    const landingShape = leafPaths(getDictionary("de"));

    for (const locale of locales) {
      expect(leafPaths(applicationDictionaries[locale])).toEqual(appShape);
      expect(leafPaths(getDictionary(locale))).toEqual(landingShape);
    }
  });

  it.each(locales)(
    "contains non-empty localized daily-use copy for %s",
    (locale) => {
      const dictionary = getAppDictionary(locale);
      for (const value of stringValues(dictionary))
        expect(value.trim()).not.toBe("");
      expect(dictionary.onboarding.steps).toHaveLength(7);
      expect(Object.keys(dictionary.reference.interests)).toHaveLength(16);
      expect(dictionary.reference.weekdays).toHaveLength(7);
    },
  );
});

const pageExpectations: Record<
  Locale,
  { aside: string; onboarding: string; interest: string }
> = {
  de: {
    aside: "Familie, Kultur und Gemeinschaft",
    onboarding: "Schaffe einen sicheren Ort",
    interest: "Ankommen in Deutschland",
  },
  fr: {
    aside: "Famille, culture et communauté",
    onboarding: "Créez un espace sûr",
    interest: "Intégration en Allemagne",
  },
  en: {
    aside: "Family, culture and community",
    onboarding: "Build a safe home",
    interest: "Integration in Germany",
  },
};

describe.each(locales)(
  "localized registration and onboarding pages (%s)",
  (locale) => {
    it("renders registration framing in the selected language", () => {
      render(<AuthPage locale={locale} mode="signup" />);
      expect(
        screen.getByText(new RegExp(pageExpectations[locale].aside)),
      ).toBeInTheDocument();
    });

    it("renders onboarding and name_key interest labels in the selected language", () => {
      render(
        <OnboardingWizard
          locale={locale}
          profileName="Mireille"
          countries={[{ id: "de", iso2: "DE", emoji: "🇩🇪", name: "Germany" }]}
          cultures={[{ id: "culture", name: "Cameroon" }]}
          languages={[{ id: "language", name: "Duala" }]}
          interests={[{ id: "interest", name_key: "interests.integration" }]}
          discoveryCopy={getDictionary(locale).discovery}
        />,
      );
      expect(
        screen.getByText(new RegExp(pageExpectations[locale].onboarding)),
      ).toBeInTheDocument();
      expect(
        screen.getByText(pageExpectations[locale].interest),
      ).toBeInTheDocument();
      expect(getAppDictionary(locale).reference.interests.integration).toBe(
        pageExpectations[locale].interest,
      );
    });
  },
);
