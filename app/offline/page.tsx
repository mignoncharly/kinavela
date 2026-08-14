import type { Metadata } from "next";

import { OfflineDashboard } from "@/components/pwa/offline-data";
import { getAppDictionary } from "@/lib/i18n/app-copy";
import { isLocale } from "@/lib/i18n/config";

type OfflinePageProps = {
  searchParams: Promise<{ locale?: string }>;
};

async function offlineLocale(searchParams: OfflinePageProps["searchParams"]) {
  const rawLocale = (await searchParams).locale ?? "de";
  return isLocale(rawLocale) ? rawLocale : "de";
}

export async function generateMetadata({
  searchParams,
}: OfflinePageProps): Promise<Metadata> {
  const locale = await offlineLocale(searchParams);
  return {
    title: getAppDictionary(locale).pwa.pageTitle,
    description: getAppDictionary(locale).pwa.body,
  };
}

export default async function OfflinePage({ searchParams }: OfflinePageProps) {
  const locale = await offlineLocale(searchParams);
  const copy = getAppDictionary(locale).pwa;
  return (
    <main className="offline-page">
      <section className="offline-hero">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <p>{copy.body}</p>
        <OfflineDashboard locale={locale} />
      </section>
    </main>
  );
}
