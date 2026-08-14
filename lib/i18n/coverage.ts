import { defaultLocale, locales, type Locale } from "./config";

export type LocalizedCopySource = Record<Locale, unknown>;

export type TranslationCoverage = {
  missing: Record<Locale, string[]>;
  unexpected: Record<Locale, string[]>;
  empty: Record<Locale, string[]>;
};

function leafValues(value: unknown, path = ""): Map<string, unknown> {
  if (Array.isArray(value)) {
    return value.reduce((leaves, item, index) => {
      for (const [key, leaf] of leafValues(item, `${path}[${index}]`))
        leaves.set(key, leaf);
      return leaves;
    }, new Map<string, unknown>());
  }
  if (value !== null && typeof value === "object") {
    return Object.entries(value).reduce((leaves, [key, item]) => {
      const nextPath = path ? `${path}.${key}` : key;
      for (const [childPath, leaf] of leafValues(item, nextPath))
        leaves.set(childPath, leaf);
      return leaves;
    }, new Map<string, unknown>());
  }
  return new Map([[path, value]]);
}

export function translationCoverage(
  source: LocalizedCopySource,
  baseLocale: Locale = defaultLocale,
): TranslationCoverage {
  const base = leafValues(source[baseLocale]);
  const missing = {} as Record<Locale, string[]>;
  const unexpected = {} as Record<Locale, string[]>;
  const empty = {} as Record<Locale, string[]>;

  for (const locale of locales) {
    const translated = leafValues(source[locale]);
    missing[locale] = [...base.keys()].filter((path) => !translated.has(path));
    unexpected[locale] = [...translated.keys()].filter(
      (path) => !base.has(path),
    );
    empty[locale] = [...translated.entries()]
      .filter(([, value]) => typeof value === "string" && value.trim() === "")
      .map(([path]) => path);
  }

  return { missing, unexpected, empty };
}

export function hasCompleteTranslationCoverage(
  source: LocalizedCopySource,
  baseLocale: Locale = defaultLocale,
) {
  const coverage = translationCoverage(source, baseLocale);
  return locales.every(
    (locale) =>
      coverage.missing[locale].length === 0 &&
      coverage.unexpected[locale].length === 0 &&
      coverage.empty[locale].length === 0,
  );
}
