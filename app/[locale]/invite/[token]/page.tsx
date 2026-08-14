import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { InvitationAcceptance } from "@/components/invitations/invitation-acceptance";
import { getInvitationCopy } from "@/features/invitations/copy";
import { parsePublicInvitation } from "@/features/invitations/results";
import { isLocale } from "@/lib/i18n/config";
import { createClient } from "@/lib/supabase/server";
import { invitationTokenSchema } from "@/lib/validation/invitations";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return { robots: { index: false, follow: false } };
  const copy = getInvitationCopy(locale);
  return {
    title: copy.publicEyebrow,
    description: copy.referralPublicBody,
    robots: { index: false, follow: false },
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale: rawLocale, token: rawToken } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = rawLocale;
  const token = invitationTokenSchema.safeParse(rawToken);
  const copy = getInvitationCopy(locale);
  const supabase = await createClient();
  const publicResult = token.success
    ? await supabase.rpc("get_public_invitation", { p_token: token.data })
    : { data: [], error: null };
  const parsed = parsePublicInvitation(publicResult.data);
  const invitation = parsed.success ? parsed.data[0] : undefined;

  if (!token.success || publicResult.error || !invitation) {
    return (
      <main className="invitation-public-page">
        <section className="invitation-public-card">
          <Link className="brand" href={`/${locale}`}>
            <span className="brand-mark">K</span>
            <span>KINAVELA</span>
          </Link>
          <p className="eyebrow">{copy.publicEyebrow}</p>
          <h1>{copy.invalidTitle}</h1>
          <p>{copy.invalidBody}</p>
          <Link className="button button-secondary" href={`/${locale}`}>
            {copy.continueApp}
          </Link>
        </section>
      </main>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("auth_user_id", user.id)
        .single()
    : { data: null };
  const villageInvitation = invitation.invitation_kind === "village";
  const title = villageInvitation
    ? copy.villagePublicTitle.replace(
        "{village}",
        invitation.village_name ?? "Kinavela Village",
      )
    : copy.referralPublicTitle;
  const body = villageInvitation
    ? copy.villagePublicBody
    : copy.referralPublicBody;
  const dateLocale =
    locale === "de" ? "de-DE" : locale === "fr" ? "fr-FR" : "en-GB";

  return (
    <main className="invitation-public-page">
      <section className="invitation-public-card">
        <Link className="brand" href={`/${locale}`}>
          <span className="brand-mark">K</span>
          <span>KINAVELA</span>
        </Link>
        <p className="eyebrow">{copy.publicEyebrow}</p>
        <h1>{title}</h1>
        <p>{body}</p>
        {villageInvitation && (
          <dl className="invitation-public-facts">
            <div>
              <dt>{copy.areaLabel}</dt>
              <dd>
                {[invitation.village_city, invitation.country_focus_name]
                  .filter(Boolean)
                  .join(" · ")}
              </dd>
            </div>
            {invitation.event_title && invitation.event_starts_at && (
              <div>
                <dt>{copy.eventLabel}</dt>
                <dd>
                  {invitation.event_title} ·{" "}
                  {new Intl.DateTimeFormat(dateLocale, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(invitation.event_starts_at))}
                </dd>
              </div>
            )}
            <div>
              <dt>{copy.expiresLabel}</dt>
              <dd>
                {new Intl.DateTimeFormat(dateLocale, {
                  dateStyle: "medium",
                }).format(new Date(invitation.expires_at))}
              </dd>
            </div>
          </dl>
        )}
        {!user ? (
          <div className="invitation-auth-actions">
            <Link
              className="button button-primary"
              href={`/${locale}/auth/signup?invite=${token.data}`}
            >
              {copy.signup}
            </Link>
            <Link
              className="button button-secondary"
              href={`/${locale}/auth/login?invite=${token.data}`}
            >
              {copy.signIn}
            </Link>
          </div>
        ) : !profile?.onboarding_completed ? (
          <Link
            className="button button-primary"
            href={`/${locale}/onboarding?invite=${token.data}`}
          >
            {copy.continueOnboarding}
          </Link>
        ) : (
          <InvitationAcceptance
            locale={locale}
            token={token.data}
            invitationKind={invitation.invitation_kind}
          />
        )}
        <p className="invitation-privacy-note">{copy.privacy}</p>
      </section>
    </main>
  );
}
