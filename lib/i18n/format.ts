import type { Locale } from "./config";

const intlLocales = {
  de: "de-DE",
  fr: "fr-FR",
  en: "en-GB",
} as const satisfies Record<Locale, string>;

export type DateFormatOptions = Intl.DateTimeFormatOptions;

export function intlLocale(locale: Locale) {
  return intlLocales[locale];
}

export function formatDate(
  locale: Locale,
  value: Date | number | string,
  options: DateFormatOptions = { dateStyle: "medium" },
) {
  return new Intl.DateTimeFormat(intlLocale(locale), options).format(
    new Date(value),
  );
}

export function formatDateTime(
  locale: Locale,
  value: Date | number | string,
  options: DateFormatOptions = { dateStyle: "medium", timeStyle: "short" },
) {
  return new Intl.DateTimeFormat(intlLocale(locale), options).format(
    new Date(value),
  );
}

export function formatTime(
  locale: Locale,
  value: Date | number | string,
  options: DateFormatOptions = { timeStyle: "short" },
) {
  return new Intl.DateTimeFormat(intlLocale(locale), options).format(
    new Date(value),
  );
}

export function formatNumber(
  locale: Locale,
  value: number,
  options?: Intl.NumberFormatOptions,
) {
  return new Intl.NumberFormat(intlLocale(locale), options).format(value);
}

export function formatCurrency(
  locale: Locale,
  value: number,
  currency: string,
  options?: Omit<Intl.NumberFormatOptions, "currency" | "style">,
) {
  return new Intl.NumberFormat(intlLocale(locale), {
    ...options,
    style: "currency",
    currency,
  }).format(value);
}

export function formatList(
  locale: Locale,
  values: Iterable<string>,
  options?: Intl.ListFormatOptions,
) {
  return new Intl.ListFormat(intlLocale(locale), options).format(values);
}

export function formatRegion(locale: Locale, region: string) {
  return (
    new Intl.DisplayNames([intlLocale(locale)], { type: "region" }).of(
      region,
    ) ?? region
  );
}

export function formatRelativeTime(
  locale: Locale,
  value: number,
  unit: Intl.RelativeTimeFormatUnit,
  options?: Intl.RelativeTimeFormatOptions,
) {
  return new Intl.RelativeTimeFormat(intlLocale(locale), options).format(
    value,
    unit,
  );
}
