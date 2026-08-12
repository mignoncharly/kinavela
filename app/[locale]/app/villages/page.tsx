import { BellOff, MapPin, ShieldCheck, Sparkles, Users } from "lucide-react";
import Link from "next/link";

import { AppHeader } from "@/components/app/app-header";
import { notFound, redirect } from "next/navigation";

import {
  CreateVillageForm,
  InvitationActions,
  RequestJoinButton,
} from "@/components/villages/village-actions";
import { ClusterRecommendationActions } from "@/components/village-discovery/cluster-recommendation-actions";
import { parseVillageClusterRecommendations } from "@/features/village-discovery/results";
import {
  parseDiscoverVillages,
  parseMyVillages,
  parseVillageInvitations,
} from "@/features/villages/results";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { createClient } from "@/lib/supabase/server";

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const copy = getDictionary(locale).villages;
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
  const [
    mineResult,
    discoverResult,
    invitationsResult,
    countriesResult,
    recommendationsResult,
  ] = await Promise.all([
    supabase.rpc("list_my_villages"),
    supabase.rpc("discover_villages"),
    supabase.rpc("list_village_invitations"),
    supabase.from("countries").select("id,name").order("name"),
    supabase.rpc("list_village_cluster_recommendations"),
  ]);
  const mine = parseMyVillages(mineResult.data);
  const discover = parseDiscoverVillages(discoverResult.data);
  const invitations = parseVillageInvitations(invitationsResult.data);
  const recommendations = parseVillageClusterRecommendations(
    recommendationsResult.data,
  );
  const unavailable =
    mineResult.error ||
    discoverResult.error ||
    invitationsResult.error ||
    !mine.success ||
    !discover.success ||
    !invitations.success;
  return (
    <main className="app-shell villages-page">
      <AppHeader active="villages" locale={locale} />
      <section className="villages-hero">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <p>{copy.intro}</p>
        <CreateVillageForm
          locale={locale}
          countries={countriesResult.data ?? []}
          copy={copy}
        />
      </section>
      {unavailable && (
        <p className="form-error" role="alert">
          {copy.unavailable}
        </p>
      )}
      {recommendationsResult.error && (
        <p className="form-error" role="alert">
          {copy.clusterUnavailable}
        </p>
      )}
      {recommendations.success && recommendations.data.length > 0 && (
        <section className="village-section cluster-section">
          <p className="eyebrow">{copy.clusterEyebrow}</p>
          <h2>{copy.clusterTitle}</h2>
          <p className="cluster-intro">{copy.clusterIntro}</p>
          <div className="village-card-grid">
            {recommendations.data.map((recommendation) => {
              const suggestedName = copy.clusterSuggestedName
                .replace("{country}", recommendation.country_name)
                .replace("{city}", recommendation.city);
              return (
                <article
                  className="village-card cluster-card"
                  key={recommendation.country_id}
                >
                  <Sparkles />
                  <div>
                    <h3>{suggestedName}</h3>
                    <p className="cluster-signal">
                      {copy.clusterFound
                        .replace("{count}", String(recommendation.family_count))
                        .replace("{country}", recommendation.country_name)
                        .replace("{city}", recommendation.city)
                        .replace("{radius}", String(recommendation.radius_km))}
                    </p>
                    <p>{copy.clusterPrivacy}</p>
                    <div
                      className="cluster-age-ranges"
                      aria-label={copy.clusterAgeRanges}
                    >
                      {recommendation.child_age_ranges.map((ageRange) => (
                        <span key={ageRange}>{ageRange}</span>
                      ))}
                    </div>
                    <ClusterRecommendationActions
                      recommendation={recommendation}
                      locale={locale}
                      copy={copy}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
      {invitations.success && invitations.data.length > 0 && (
        <section className="village-section">
          <h2>{copy.invitations}</h2>
          <div className="village-card-grid">
            {invitations.data.map((invitation) => (
              <article className="village-card" key={invitation.village_id}>
                <ShieldCheck />
                <div>
                  <h3>{invitation.village_name}</h3>
                  <p>
                    <MapPin size={15} /> {invitation.city}
                  </p>
                  <p>
                    {copy.invitedBy.replace(
                      "{family}",
                      invitation.inviter_family_name,
                    )}
                  </p>
                  <InvitationActions
                    villageId={invitation.village_id}
                    copy={copy}
                  />
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
      {mine.success && (
        <section className="village-section">
          <h2>{copy.yourVillages}</h2>
          {mine.data.length === 0 ? (
            <p className="empty-chat">{copy.noVillages}</p>
          ) : (
            <div className="village-card-grid">
              {mine.data.map((village) => (
                <Link
                  className="village-card"
                  href={`/${locale}/app/villages/${village.village_id}`}
                  key={village.village_id}
                >
                  <Users />
                  <div>
                    <h3>{village.name}</h3>
                    <p>
                      <MapPin size={15} /> {village.city}
                    </p>
                    <p>
                      {copy.memberCount.replace(
                        "{count}",
                        String(village.member_count),
                      )}{" "}
                      · {copy.roles[village.member_role]}
                    </p>
                    {village.muted && (
                      <small>
                        <BellOff size={14} /> {copy.muted}
                      </small>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}
      {discover.success && (
        <section className="village-section">
          <h2>{copy.nearby}</h2>
          {discover.data.length === 0 ? (
            <p className="empty-chat">{copy.noNearby}</p>
          ) : (
            <div className="village-card-grid">
              {discover.data.map((village) => (
                <article className="village-card" key={village.village_id}>
                  <MapPin />
                  <div>
                    <h3>{village.name}</h3>
                    <p>{village.description}</p>
                    <p>
                      {village.city} ·{" "}
                      {copy.memberCount.replace(
                        "{count}",
                        String(village.member_count),
                      )}
                    </p>
                    <RequestJoinButton
                      villageId={village.village_id}
                      copy={copy}
                    />
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
