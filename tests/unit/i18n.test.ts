import { describe, expect, it } from "vitest";

import { defaultLocale, isLocale, locales } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

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
  });
});
