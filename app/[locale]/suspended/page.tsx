import Link from "next/link";
import { notFound } from "next/navigation";

import { isLocale } from "@/lib/i18n/config";

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <main className="app-shell">
      <section className="settings-panel">
        <p className="eyebrow">ACCOUNT ACCESS</p>
        <h1>Account temporarily unavailable</h1>
        <p>
          Your Kinavela account is suspended while our moderation team reviews
          it. If you believe this is a mistake, contact support through the
          address in the privacy notice.
        </p>
        <Link className="back-link" href={`/${locale}`}>
          Return to Kinavela
        </Link>
      </section>
    </main>
  );
}
