import { AppHeader } from "@/components/app/app-header";
import { notFound, redirect } from "next/navigation";

import { BillingPanel } from "@/components/billing/billing-panel";
import { DeletionButton } from "@/components/app/account-actions";
import { NotificationPreferencesForm } from "@/components/notifications/notification-preferences";
import { PrivacyControls } from "@/components/privacy/privacy-controls";
import { SettingsForm } from "@/components/app/settings-form";
import { billingEntitlementsSchema } from "@/lib/validation/billing";
import { isLocale } from "@/lib/i18n/config";
import { notificationPreferencesSchema } from "@/lib/validation/notifications";
import { createClient } from "@/lib/supabase/server";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ billing?: string }>;
}) {
  const { locale } = await params;
  const billingNotice = (await searchParams)?.billing;
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
  const { data: preferencesData } = await supabase.rpc(
    "get_notification_preferences",
  );
  const preferences = notificationPreferencesSchema.safeParse(
    Array.isArray(preferencesData) ? preferencesData[0] : preferencesData,
  );
  const { data: entitlementsData } = await supabase.rpc("get_my_entitlements");
  const { data: billingEnabled } = await supabase.rpc("is_feature_enabled", {
    p_flag_key: "premium_billing",
  });
  const entitlements = billingEntitlementsSchema.safeParse(
    Array.isArray(entitlementsData) ? entitlementsData[0] : entitlementsData,
  );

  return (
    <main className="app-shell settings-page">
      <AppHeader active="settings" locale={locale} />
      <section className="settings-panel">
        <p className="eyebrow">ACCOUNT</p>
        <h1>Settings</h1>
        <SettingsForm
          name={profile?.display_name ?? ""}
          city={profile?.city ?? ""}
          locale={locale}
        />
        <NotificationPreferencesForm
          initial={
            preferences.success
              ? preferences.data
              : {
                  email_enabled: false,
                  push_enabled: false,
                  push_subscription_count: 0,
                }
          }
        />
        {billingEnabled && (
          <BillingPanel
            notice={
              billingNotice === "success" || billingNotice === "cancelled"
                ? billingNotice
                : undefined
            }
            initial={
              entitlements.success
                ? entitlements.data
                : {
                    plan: "free",
                    status: "free",
                    has_billing_customer: false,
                    roots_stories_ai: false,
                    current_period_end: null,
                    cancel_at_period_end: false,
                  }
            }
          />
        )}
        <PrivacyControls />
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
