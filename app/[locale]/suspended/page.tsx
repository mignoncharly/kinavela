import Link from "next/link";
import { notFound } from "next/navigation";

import { accountStateCopy } from "@/components/legal/account-state-copy";
import { isLocale } from "@/lib/i18n/config";

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const copy = accountStateCopy[locale];
  return (
    <main className="app-shell">
      <section className="settings-panel">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <p>{copy.body}</p>
        <Link className="back-link" href={`/${locale}`}>
          {copy.return}
        </Link>
      </section>
    </main>
  );
}
