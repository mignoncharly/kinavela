import { redirect, notFound } from "next/navigation";

import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { createClient } from "@/lib/supabase/server";
import { invitationTokenSchema } from "@/lib/validation/invitations";
import { onboardingDraftSchema } from "@/lib/validation/onboarding";
import { parsePublicInvitation } from "@/features/invitations/results";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ invite?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const invitation = invitationTokenSchema.safeParse(query.invite);
  const dictionary = getDictionary(locale);
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
  if (profile?.onboarding_completed)
    redirect(
      invitation.success
        ? `/${locale}/invite/${invitation.data}`
        : `/${locale}/app`,
    );
  const [
    { data: countries },
    { data: cultures },
    { data: languages },
    { data: interests },
  ] = await Promise.all([
    supabase.rpc("list_localized_countries", { p_locale: locale }),
    supabase.rpc("list_localized_cultures", { p_locale: locale }),
    supabase.rpc("list_localized_languages", { p_locale: locale }),
    supabase
      .from("interests")
      .select("id,name_key")
      .eq("active", true)
      .order("sort_order"),
  ]);
  const [{ data: draftData }, publicInvitationResult] = await Promise.all([
    supabase.rpc("get_my_onboarding_draft"),
    invitation.success
      ? supabase.rpc("get_public_invitation", { p_token: invitation.data })
      : Promise.resolve({ data: [], error: null }),
  ]);
  const parsedDraft = onboardingDraftSchema.safeParse(draftData);
  const parsedInvitation = parsePublicInvitation(publicInvitationResult.data);
  const invitationContext = parsedInvitation.success
    ? parsedInvitation.data[0]
    : undefined;

  return (
    <OnboardingWizard
      locale={locale}
      profileName={profile?.display_name ?? ""}
      countries={countries ?? []}
      cultures={cultures ?? []}
      languages={languages ?? []}
      interests={interests ?? []}
      discoveryCopy={dictionary.discovery}
      inviteToken={invitation.success ? invitation.data : undefined}
      inviteContext={
        invitationContext
          ? {
              kind: invitationContext.invitation_kind,
              name: invitationContext.village_name ?? undefined,
            }
          : undefined
      }
      initialDraft={parsedDraft.success ? parsedDraft.data : undefined}
    />
  );
}
