import { ArrowLeft, Compass, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { AppHeader } from "@/components/app/app-header";
import { notFound, redirect } from "next/navigation";

import { MissionBoard } from "@/components/missions/mission-actions";
import { OfflineSnapshotButton } from "@/components/pwa/offline-data";
import { parseCulturalMissions } from "@/features/missions/results";
import { isLocale } from "@/lib/i18n/config";
import { getAppDictionary } from "@/lib/i18n/app-copy";
import { getMissionCopy } from "@/features/missions/copy";
import { createClient } from "@/lib/supabase/server";

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const copy = getMissionCopy(locale);
  const appCopy = getAppDictionary(locale);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/auth/login`);
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("auth_user_id", user.id)
    .single();
  if (!profile?.onboarding_completed) redirect(`/${locale}/onboarding`);

  const result = await supabase.rpc("list_cultural_missions_v3", {
    p_locale: locale,
  });
  const missions = parseCulturalMissions(result.data);
  return (
    <main className="app-shell missions-page">
      <AppHeader active="missions" locale={locale} />
      <section className="missions-hero">
        <Link className="back-link" href={`/${locale}/app`}>
          <ArrowLeft size={17} /> {copy.back}
        </Link>
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <p>{copy.intro}</p>
      </section>
      <section className="village-tab-panel">
        <div className="phase-empty" style={{ marginBottom: 24 }}>
          <Compass />
          <div>
            <h2>{copy.library}</h2>
            <p>{copy.privacy}</p>
          </div>
          <ShieldCheck />
        </div>
        {result.error || !missions.success ? (
          <p className="form-error" role="alert">
            {copy.unavailable}
          </p>
        ) : (
          <>
            <OfflineSnapshotButton
              kind="missions"
              payload={missions.data}
              label={appCopy.pwa.saveMissions}
              locale={locale}
            />
            <MissionBoard copy={copy} missions={missions.data} />
          </>
        )}
      </section>
    </main>
  );
}
