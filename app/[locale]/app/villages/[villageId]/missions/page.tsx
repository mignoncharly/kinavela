import { ArrowLeft, Languages } from "lucide-react";
import Link from "next/link";

import { AppHeader } from "@/components/app/app-header";
import { notFound, redirect } from "next/navigation";

import { MissionBoard } from "@/components/missions/mission-actions";
import { getMissionCopy } from "@/features/missions/copy";
import {
  parseCulturalMissions,
  parseVillageMissions,
} from "@/features/missions/results";
import { parseVillageDetail } from "@/features/villages/results";
import { isLocale } from "@/lib/i18n/config";
import { createClient } from "@/lib/supabase/server";
import { villageIdSchema } from "@/lib/validation/villages";

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; villageId: string }>;
}) {
  const { locale, villageId: rawVillageId } = await params;
  if (!isLocale(locale)) notFound();
  const parsedId = villageIdSchema.safeParse({ village_id: rawVillageId });
  if (!parsedId.success) notFound();
  const copy = getMissionCopy(locale);
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

  const [detailResult, libraryResult, villageResult] = await Promise.all([
    supabase.rpc("get_village", { p_village_id: parsedId.data.village_id }),
    supabase.rpc("list_cultural_missions_v3", { p_locale: locale }),
    supabase.rpc("list_village_missions_v3", {
      p_village_id: parsedId.data.village_id,
      p_locale: locale,
    }),
  ]);
  const detail = parseVillageDetail(detailResult.data);
  const library = parseCulturalMissions(libraryResult.data);
  const villageMissions = parseVillageMissions(villageResult.data);
  if (
    detailResult.error ||
    libraryResult.error ||
    villageResult.error ||
    !detail.success ||
    !library.success ||
    !villageMissions.success
  )
    notFound();
  const village = detail.data[0];
  if (!village) notFound();

  return (
    <main className="app-shell missions-page">
      <AppHeader active="missions" locale={locale} />
      <section className="missions-hero">
        <Link
          className="back-link"
          href={`/${locale}/app/villages/${village.village_id}`}
        >
          <ArrowLeft size={17} /> {copy.back}
        </Link>
        <p className="eyebrow">
          <Languages size={14} /> {village.name}
        </p>
        <h1>{copy.villageMissions}</h1>
        <p>{copy.privacy}</p>
      </section>
      <MissionBoard
        canAssign={["owner", "organizer"].includes(village.member_role)}
        copy={copy}
        missions={library.data}
        villageId={village.village_id}
        villageMissions={villageMissions.data}
      />
    </main>
  );
}
