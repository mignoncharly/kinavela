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
        <p className="eyebrow">YOUR FAMILY HOME</p>
        <h1>Welcome, {profile.display_name}</h1>
        <p>Your Kinavela space is active and private.</p>
      </section>
      <section className="dashboard-grid">
        <article>
          <Sprout />
          <small>Family</small>
          <h2>{family?.name ?? "Your family"}</h2>
          <p>{family?.bio || "Your family profile is ready to grow."}</p>
        </article>
        <Link className="dashboard-card" href={`/${locale}/app/discover`}>
          <MapPin />
          <small>Discovery</small>
          <h2>
            {family?.city}, {family?.country_of_residence}
          </h2>
          <p>
            {family?.visibility === "private"
              ? "Private"
              : `Discoverable within ${family?.discovery_radius_km} km`}
            —never an exact address.
          </p>
        </Link>
        <Link className="dashboard-card" href={`/${locale}/app/connections`}>
          <Users />
          <small>Connections</small>
          <h2>Build mutual trust</h2>
          <p>Private details open only after both families agree.</p>
        </Link>
        <Link className="dashboard-card" href={`/${locale}/app/messages`}>
          <MessageCircle />
          <small>Messages</small>
          <h2>
            {typeof unreadMessageCount === "number" ? unreadMessageCount : 0}{" "}
            unread
          </h2>
          <p>Private conversations with mutually connected families.</p>
        </Link>
        <Link className="dashboard-card" href={`/${locale}/app/villages`}>
          <Trees />
          <small>Villages</small>
          <h2>{Array.isArray(villages) ? villages.length : 0} joined</h2>
          <p>Build a private local community with trusted families.</p>
        </Link>
        <article>
          <ShieldCheck />
          <small>Children</small>
          <h2>{childCount ?? 0} protected profiles</h2>
          <p>Visible only inside your family by default.</p>
        </article>
      </section>
    </main>
  );
}
