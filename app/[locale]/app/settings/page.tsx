import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DeletionButton, LogoutButton } from "@/components/app/account-actions";
import { SettingsForm } from "@/components/app/settings-form";
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
    .select("display_name,city")
    .eq("auth_user_id", user.id)
    .single();
  return (
    <main className="app-shell">
      <header className="app-header">
        <Link className="brand" href={`/${locale}/app`}>
          <span className="brand-mark">K</span>KINAVELA
        </Link>
        <LogoutButton locale={locale} />
      </header>
      <section className="settings-panel">
        <p className="eyebrow">ACCOUNT</p>
        <h1>Settings</h1>
        <SettingsForm
          name={profile?.display_name ?? ""}
          city={profile?.city ?? ""}
          locale={locale}
        />
        <hr />
        <h2>Privacy and account</h2>
        <p>
          Account deletion requests are audited and handled through a protected
          workflow.
        </p>
        <DeletionButton />
      </section>
    </main>
  );
}
