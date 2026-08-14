import { notFound, redirect } from "next/navigation";

import { DeletionButton } from "@/components/app/account-actions";
import { AppHeader } from "@/components/app/app-header";
import { FamilySettingsEditor } from "@/components/app/family-settings-editor";
import { SettingsForm } from "@/components/app/settings-form";
import { BillingPanel } from "@/components/billing/billing-panel";
import { LocationSetup } from "@/components/discovery/discovery-actions";
import { NotificationPreferencesForm } from "@/components/notifications/notification-preferences";
import { PrivacyControls } from "@/components/privacy/privacy-controls";
import { InvitationLinkCreator } from "@/components/invitations/invitation-sharing";
import { TrustCenter } from "@/components/trust/trust-center";
import { parseMyVillages } from "@/features/villages/results";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getAppDictionary } from "@/lib/i18n/app-copy";
import { isLocale } from "@/lib/i18n/config";
import { createClient } from "@/lib/supabase/server";
import { billingEntitlementsSchema } from "@/lib/validation/billing";
import { familySettingsSchema } from "@/lib/validation/family-settings";
import { notificationPreferencesSchema } from "@/lib/validation/notifications";
import { trustStatusSchema } from "@/lib/validation/trust";

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
    .select("id,display_name")
    .eq("auth_user_id", user.id)
    .single();
  if (!profile) redirect(`/${locale}/auth/login`);

  const { data: membership } = await supabase
    .from("family_members")
    .select(
      "family_id,role,families(name,bio,visibility,city,country_of_residence,discovery_radius_km,preservation_goals)",
    )
    .eq("profile_id", profile.id)
    .eq("status", "active")
    .single();
  const familyRelation = membership?.families;
  const family = Array.isArray(familyRelation)
    ? familyRelation[0]
    : familyRelation;
  if (!membership || !family) redirect(`/${locale}/onboarding`);

  const [
    childrenResult,
    familyCulturesResult,
    familyLanguagesResult,
    familyInterestsResult,
    availabilityResult,
    discoveryPreferencesResult,
    culturesResult,
    languagesResult,
    interestsResult,
    countriesResult,
    preferencesResult,
    entitlementsResult,
    billingEnabledResult,
    trustResult,
    villagesResult,
  ] = await Promise.all([
    supabase
      .from("children")
      .select("id,nickname,birth_year,birth_month,gender,visibility")
      .eq("family_id", membership.family_id)
      .order("created_at"),
    supabase
      .from("family_cultures")
      .select("culture_id,relationship_type,priority")
      .eq("family_id", membership.family_id)
      .order("created_at"),
    supabase
      .from("family_languages")
      .select("language_id,proficiency,transmission_goal")
      .eq("family_id", membership.family_id)
      .order("created_at"),
    supabase
      .from("family_interests")
      .select("interest_id")
      .eq("family_id", membership.family_id),
    supabase
      .from("family_availability")
      .select("weekday,period")
      .eq("family_id", membership.family_id)
      .order("weekday")
      .order("period"),
    supabase
      .from("discovery_preferences")
      .select(
        "same_country_priority,same_culture_priority,similar_child_age_priority,same_language_priority,shared_interests_priority,availability_priority,open_to_other_african_families,open_to_all_diaspora_families,min_child_age,max_child_age",
      )
      .eq("family_id", membership.family_id)
      .single(),
    supabase.rpc("list_localized_cultures", { p_locale: locale }),
    supabase.rpc("list_localized_languages", { p_locale: locale }),
    supabase
      .from("interests")
      .select("id,name_key")
      .eq("active", true)
      .order("sort_order"),
    supabase.rpc("list_localized_countries", {
      p_locale: locale,
      p_iso2: "DE",
    }),
    supabase.rpc("get_notification_preferences"),
    supabase.rpc("get_my_entitlements"),
    supabase.rpc("is_feature_enabled", { p_flag_key: "premium_billing" }),
    supabase.rpc("get_my_trust_status"),
    supabase.rpc("list_my_villages"),
  ]);

  const initialSettings = familySettingsSchema.safeParse({
    family: {
      name: family.name,
      bio: family.bio ?? "",
      visibility: family.visibility,
    },
    children: (childrenResult.data ?? []).map((child) => ({
      ...child,
      id: child.id,
    })),
    cultures: familyCulturesResult.data ?? [],
    languages: familyLanguagesResult.data ?? [],
    preservation_goals: family.preservation_goals,
    interest_ids: (familyInterestsResult.data ?? []).map(
      (interest) => interest.interest_id,
    ),
    availability: availabilityResult.data ?? [],
    preferences: discoveryPreferencesResult.data,
  });

  const notificationPreferences = notificationPreferencesSchema.safeParse(
    Array.isArray(preferencesResult.data)
      ? preferencesResult.data[0]
      : preferencesResult.data,
  );
  const entitlements = billingEntitlementsSchema.safeParse(
    Array.isArray(entitlementsResult.data)
      ? entitlementsResult.data[0]
      : entitlementsResult.data,
  );
  const trustStatus = trustStatusSchema.safeParse(
    Array.isArray(trustResult.data) ? trustResult.data[0] : trustResult.data,
  );
  const villages = parseMyVillages(villagesResult.data);
  const dictionary = getDictionary(locale);
  const appDictionary = getAppDictionary(locale);
  const copy = appDictionary.settings;
  const countryName =
    new Intl.DisplayNames([locale], { type: "region" }).of("DE") ?? "DE";

  return (
    <main className="app-shell settings-page">
      <AppHeader active="settings" locale={locale} />
      <section className="settings-panel">
        <p className="eyebrow">{copy.accountEyebrow}</p>
        <h1>{copy.title}</h1>
        <SettingsForm name={profile.display_name} locale={locale} />

        <hr />
        {trustStatus.success && (
          <>
            <TrustCenter
              locale={locale}
              initial={trustStatus.data}
              villages={
                villages.success
                  ? villages.data.map((village) => ({
                      village_id: village.village_id,
                      name: village.name,
                    }))
                  : []
              }
            />
            <hr />
          </>
        )}
        <div className="settings-heading">
          <p className="eyebrow">{copy.familyEyebrow}</p>
          <h2>{copy.familyTitle}</h2>
          <p>{copy.area.replace("{area}", `${family.city}, ${countryName}`)}</p>
        </div>
        {membership.role === "owner" ? (
          <>
            {initialSettings.success ? (
              <FamilySettingsEditor
                initial={initialSettings.data}
                cultures={culturesResult.data ?? []}
                languages={languagesResult.data ?? []}
                interests={interestsResult.data ?? []}
                locale={locale}
              />
            ) : (
              <p className="form-error" role="alert">
                {copy.loadFailed}
              </p>
            )}
            <section className="family-settings-section">
              <LocationSetup
                locale={locale}
                initialCountry="DE"
                initialRadius={family.discovery_radius_km}
                countries={countriesResult.data ?? []}
                copy={dictionary.discovery}
              />
            </section>
          </>
        ) : (
          <div className="privacy-notice">
            {copy.ownerOnly.replace("{role}", membership.role)}
          </div>
        )}

        <hr />
        <div id="family-referral">
          <InvitationLinkCreator
            locale={locale}
            invitationKind="family_referral"
          />
        </div>

        <hr />
        <NotificationPreferencesForm
          locale={locale}
          initial={
            notificationPreferences.success
              ? notificationPreferences.data
              : {
                  email_enabled: false,
                  push_enabled: false,
                  push_subscription_count: 0,
                  community_enabled: true,
                  events_enabled: true,
                  direct_enabled: true,
                  heritage_enabled: true,
                  safety_enabled: true,
                }
          }
        />
        {billingEnabledResult.data && (
          <BillingPanel
            locale={locale}
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
        <PrivacyControls locale={locale} />
        <hr />
        <h2>{copy.privacyTitle}</h2>
        <p>{copy.deletionBody}</p>
        <DeletionButton copy={copy} />
      </section>
    </main>
  );
}
