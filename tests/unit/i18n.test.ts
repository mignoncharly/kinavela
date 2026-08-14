import { describe, expect, it } from "vitest";

import { defaultLocale, isLocale, locales } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { formatRegion } from "@/lib/i18n/format";

describe("internationalization foundation", () => {
  it("supports the three launch languages", () => {
    expect(locales).toEqual(["de", "fr", "en"]);
    expect(defaultLocale).toBe("de");
  });

  it("rejects unsupported locale input", () => {
    expect(isLocale("de")).toBe(true);
    expect(isLocale("es")).toBe(false);
  });

  it.each(locales)("contains complete landing copy for %s", (locale) => {
    const dictionary = getDictionary(locale);
    expect(dictionary.hero.title.length).toBeGreaterThan(10);
    expect(dictionary.journey.steps).toHaveLength(4);
    expect(dictionary.trust.items).toHaveLength(4);
    expect(dictionary.nav.homeLabel).not.toHaveLength(0);
    expect(dictionary.footer.legalLabel).not.toHaveLength(0);
    expect(dictionary.hero.illustrationLabel).not.toHaveLength(0);
  });

  it("keeps locale-prefixed authentication and onboarding paths", () => {
    for (const locale of locales) {
      expect(`/${locale}/auth/signup`).toMatch(/^\/(de|fr|en)\/auth\/signup$/);
      expect(`/${locale}/onboarding`).toMatch(/^\/(de|fr|en)\/onboarding$/);
    }
  });

  it("formats country codes in the selected interface locale", () => {
    expect(formatRegion("de", "DE")).toBe("Deutschland");
    expect(formatRegion("fr", "DE")).toBe("Allemagne");
    expect(formatRegion("en", "DE")).toBe("Germany");
  });
});
