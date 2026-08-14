import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { AppHeader } from "@/components/app/app-header";
import { notFound, redirect } from "next/navigation";

import { NotificationCenter } from "@/components/notifications/notification-center";
import { parseNotificationFeed } from "@/features/notifications/results";
import { isLocale } from "@/lib/i18n/config";
import { getAppDictionary } from "@/lib/i18n/app-copy";
import { createClient } from "@/lib/supabase/server";

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const copy = getAppDictionary(locale).notifications;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/auth/login`);
  const { data, error } = await supabase.rpc("list_notification_feed", {
    p_limit: 50,
  });
  const notifications = parseNotificationFeed(data);
  return (
    <main className="app-shell notifications-page">
      <AppHeader active="notifications" locale={locale} />
      <section className="settings-panel">
        <Link className="back-link" href={`/${locale}/app`}>
          <ArrowLeft size={17} /> {copy.back}
        </Link>
        {error || !notifications.success ? (
          <p className="form-error">{copy.unavailable}</p>
        ) : (
          <NotificationCenter items={notifications.data} locale={locale} />
        )}
      </section>
    </main>
  );
}
