import {
  MapPin,
  MessageCircle,
  ShieldCheck,
  Sprout,
  Trees,
  Users,
} from "lucide-react";
import Link from "next/link";

import { AppHeader } from "@/components/app/app-header";
import { notFound, redirect } from "next/navigation";

import { isLocale } from "@/lib/i18n/config";
import { getAppDictionary } from "@/lib/i18n/app-copy";
import { formatRegion } from "@/lib/i18n/format";
import { createClient } from "@/lib/supabase/server";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ welcome?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const copy = getAppDictionary(locale).dashboard;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/auth/login`);
  const { data: profile } = await supabase
    .from("profiles")
    .select("id,display_name,onboarding_completed,verification_level")
    .eq("auth_user_id", user.id)
    .single();
  if (!profile?.onboarding_completed) redirect(`/${locale}/onboarding`);
  const { data: membership } = await supabase
    .from("family_members")
    .select(
      "family_id,role,families(name,city,country_of_residence,visibility,discovery_radius_km,bio)",
    )
    .eq("profile_id", profile.id)
    .eq("status", "active")
    .single();
  const family = Array.isArray(membership?.families)
    ? membership.families[0]
    : membership?.families;
  const { count: childCount } = membership
    ? await supabase
        .from("children")
        .select("id", { count: "exact", head: true })
        .eq("family_id", membership.family_id)
    : { count: 0 };
  const [{ data: unreadMessageCount }, { data: villages }] = await Promise.all([
    supabase.rpc("get_unread_message_count"),
    supabase.rpc("list_my_villages"),
  ]);
  return (
    <main className="app-shell dashboard-page">
      <AppHeader
        active="home"
        locale={locale}
        unreadCount={
          typeof unreadMessageCount === "number" ? unreadMessageCount : 0
        }
      />
      <section className="app-welcome">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1>{copy.welcome.replace("{name}", profile.display_name)}</h1>
        <p>{copy.active}</p>
      </section>
      {query.welcome === "1" && (
        <section
          className="welcome-next-actions"
          aria-labelledby="welcome-next-title"
        >
          <p className="eyebrow">{copy.nextEyebrow}</p>
          <h2 id="welcome-next-title">{copy.nextTitle}</h2>
          <p>{copy.nextBody}</p>
          <div>
            <Link
              className="button button-primary"
              href={`/${locale}/app/discover`}
            >
              {copy.findFamilies}
            </Link>
            <Link
              className="button button-secondary"
              href={`/${locale}/app/villages`}
            >
              {copy.joinVillage}
            </Link>
            <Link
              className="button button-secondary"
              href={`/${locale}/app/villages#create-village`}
            >
              {copy.createVillage}
            </Link>
            <Link
              className="button button-secondary"
              href={`/${locale}/app/settings#family-referral`}
            >
              {copy.inviteFamily}
            </Link>
          </div>
        </section>
      )}
      <section className="dashboard-grid">
        <article>
          <Sprout />
          <small>{copy.family}</small>
          <h2>{family?.name ?? copy.yourFamily}</h2>
          <p>{family?.bio || copy.familyReady}</p>
        </article>
        <Link className="dashboard-card" href={`/${locale}/app/discover`}>
          <MapPin />
          <small>{copy.discovery}</small>
          <h2>
            {family?.city},{" "}
            {family ? formatRegion(locale, family.country_of_residence) : ""}
          </h2>
          <p>
            {family?.visibility === "private"
              ? copy.private
              : copy.discoverable.replace(
                  "{radius}",
                  String(family?.discovery_radius_km),
                )}
            {copy.approximate}
          </p>
        </Link>
        <Link className="dashboard-card" href={`/${locale}/app/connections`}>
          <Users />
          <small>{copy.connections}</small>
          <h2>{copy.trust}</h2>
          <p>{copy.trustBody}</p>
        </Link>
        <Link className="dashboard-card" href={`/${locale}/app/messages`}>
          <MessageCircle />
          <small>{copy.messages}</small>
          <h2>
            {copy.unread.replace(
              "{count}",
              String(
                typeof unreadMessageCount === "number" ? unreadMessageCount : 0,
              ),
            )}
          </h2>
          <p>{copy.messagesBody}</p>
        </Link>
        <Link className="dashboard-card" href={`/${locale}/app/villages`}>
          <Trees />
          <small>{copy.villages}</small>
          <h2>
            {copy.joined.replace(
              "{count}",
              String(Array.isArray(villages) ? villages.length : 0),
            )}
          </h2>
          <p>{copy.villagesBody}</p>
        </Link>
        <article>
          <ShieldCheck />
          <small>{copy.children}</small>
          <h2>{copy.protected.replace("{count}", String(childCount ?? 0))}</h2>
          <p>{copy.childrenBody}</p>
        </article>
      </section>
    </main>
  );
}
