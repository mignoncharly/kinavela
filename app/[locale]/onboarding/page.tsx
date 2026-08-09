import { redirect, notFound } from "next/navigation";

import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { isLocale } from "@/lib/i18n/config";
import { createClient } from "@/lib/supabase/server";

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/auth/login`);
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name,onboarding_completed")
    .eq("auth_user_id", user.id)
    .single();
  if (profile?.onboarding_completed) redirect(`/${locale}/app`);
  const [
    { data: countries },
    { data: cultures },
    { data: languages },
    { data: interests },
  ] = await Promise.all([
    supabase.from("countries").select("id,iso2,name,emoji").order("name"),
    supabase.from("cultures").select("id,name").order("name"),
    supabase.from("languages").select("id,name").order("name"),
    supabase
      .from("interests")
      .select("id,slug")
      .eq("active", true)
      .order("sort_order"),
  ]);
  return (
    <OnboardingWizard
      locale={locale}
      profileName={profile?.display_name ?? ""}
      countries={countries ?? []}
      cultures={cultures ?? []}
      languages={languages ?? []}
      interests={interests ?? []}
    />
  );
}
