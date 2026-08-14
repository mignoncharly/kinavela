import { describe, expect, it } from "vitest";

import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatList,
  formatNumber,
  formatRelativeTime,
  formatTime,
  intlLocale,
} from "@/lib/i18n/format";
import {
  hasCompleteTranslationCoverage,
  translationCoverage,
} from "@/lib/i18n/coverage";
import { localizedCopySources } from "@/lib/i18n/sources";
import { locales } from "@/lib/i18n/config";

describe("Localization Phase L0 coverage", () => {
  it("keeps every registered translation source complete", () => {
    for (const [name, source] of Object.entries(localizedCopySources)) {
      expect(hasCompleteTranslationCoverage(source), name).toBe(true);
    }
  });

  it("reports missing, unexpected, and empty translation values", () => {
    const coverage = translationCoverage({
      de: { title: "Titel", nested: { body: "Inhalt" } },
      fr: { title: "", extra: "supplément" },
      en: { title: "Title", nested: { body: "Body" } },
    });

    expect(coverage.missing.fr).toEqual(["nested.body"]);
    expect(coverage.unexpected.fr).toEqual(["extra"]);
    expect(coverage.empty.fr).toEqual(["title"]);
  });
});

describe("Localization Phase L0 formatting", () => {
  const instant = "2026-08-13T14:05:00.000Z";
  const dateOptions = {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  } as const;
  const timeOptions = {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  } as const;

  it.each(locales)("uses the selected locale for %s formatting", (locale) => {
    const intl = intlLocale(locale);

    expect(formatDate(locale, instant, dateOptions)).toBe(
      new Intl.DateTimeFormat(intl, dateOptions).format(new Date(instant)),
    );
    expect(
      formatDateTime(locale, instant, { ...dateOptions, ...timeOptions }),
    ).toBe(
      new Intl.DateTimeFormat(intl, {
        ...dateOptions,
        ...timeOptions,
      }).format(new Date(instant)),
    );
    expect(formatTime(locale, instant, timeOptions)).toBe(
      new Intl.DateTimeFormat(intl, timeOptions).format(new Date(instant)),
    );
    expect(formatNumber(locale, 12345.6)).toBe(
      new Intl.NumberFormat(intl).format(12345.6),
    );
    expect(formatCurrency(locale, 1234.5, "EUR")).toBe(
      new Intl.NumberFormat(intl, {
        style: "currency",
        currency: "EUR",
      }).format(1234.5),
    );
    expect(formatList(locale, ["Roots", "Village", "Stories"])).toBe(
      new Intl.ListFormat(intl).format(["Roots", "Village", "Stories"]),
    );
    expect(formatRelativeTime(locale, -2, "day")).toBe(
      new Intl.RelativeTimeFormat(intl).format(-2, "day"),
    );
  });

  it("uses Germany, France, and UK English conventions deliberately", () => {
    expect(intlLocale("de")).toBe("de-DE");
    expect(intlLocale("fr")).toBe("fr-FR");
    expect(intlLocale("en")).toBe("en-GB");
  });
});
