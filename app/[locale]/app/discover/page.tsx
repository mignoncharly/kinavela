import { Baby, Languages, MapPin, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";

import { AppHeader } from "@/components/app/app-header";
import { notFound, redirect } from "next/navigation";

import {
  BlockFamilyButton,
  LocationSetup,
  UnblockFamilyButton,
} from "@/components/discovery/discovery-actions";
import { ConnectionRequestButton } from "@/components/connections/connection-actions";
import { ProductEventTracker } from "@/components/metrics/product-event-tracker";
import { parseConnectionResults } from "@/features/connections/results";
import {
  parseMatchResults,
  type MatchReason,
  type MatchResult,
} from "@/features/matching/results";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { createClient } from "@/lib/supabase/server";
import {
  blockedFamilySchema,
  discoverySearchSchema,
} from "@/lib/validation/discovery";

type SearchParameters = Record<string, string | string[] | undefined>;

function scalar(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParameters>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const copy = getDictionary(locale).discovery;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/auth/login`);
  const { data: profile } = await supabase
    .from("profiles")
    .select("id,onboarding_completed")
    .eq("auth_user_id", user.id)
    .single();
  if (!profile?.onboarding_completed) redirect(`/${locale}/onboarding`);

  const [
    membershipResult,
    countriesResult,
    culturesResult,
    languagesResult,
    interestsResult,
  ] = await Promise.all([
    supabase
      .from("family_members")
      .select(
        "family_id,families(city,country_of_residence,discovery_radius_km,location)",
      )
      .eq("profile_id", profile.id)
      .eq("status", "active")
      .single(),
    supabase.from("countries").select("iso2,name,emoji").order("name"),
    supabase.from("cultures").select("id,name").order("name"),
    supabase.from("languages").select("id,name").order("name"),
    supabase
      .from("interests")
      .select("id,slug")
      .eq("active", true)
      .order("sort_order"),
  ]);
  const familyRelation = membershipResult.data?.families;
  const family = Array.isArray(familyRelation)
    ? familyRelation[0]
    : familyRelation;
  if (!family) redirect(`/${locale}/onboarding`);

  const raw = await searchParams;
  const availability = scalar(raw.availability)?.split(":");
  const parsedFilters = discoverySearchSchema.safeParse({
    radius: scalar(raw.radius),
    country: scalar(raw.country),
    culture: scalar(raw.culture),
    language: scalar(raw.language),
    interest: scalar(raw.interest),
    minAge: scalar(raw.minAge),
    maxAge: scalar(raw.maxAge),
    weekday: availability?.[0],
    period: availability?.[1],
  });
  const filters = parsedFilters.success ? parsedFilters.data : {};
  let families: MatchResult[] = [];
  let discoveryError = false;
  let blockedFamilies: ReturnType<typeof blockedFamilySchema.parse>[] = [];
  const connectionStates = new Map<string, "requested" | "accepted">();
  if (family.location) {
    const [{ data, error }, blockedResult, connectionsResult] =
      await Promise.all([
        supabase.rpc("match_families", {
          p_radius_km: filters.radius ?? null,
          p_country_code: filters.country ?? null,
          p_culture_ids: filters.culture ? [filters.culture] : null,
          p_language_ids: filters.language ? [filters.language] : null,
          p_interest_ids: filters.interest ? [filters.interest] : null,
          p_min_child_age: filters.minAge ?? null,
          p_max_child_age: filters.maxAge ?? null,
          p_weekday: filters.weekday ?? null,
          p_period: filters.period ?? null,
          p_limit: 30,
          p_offset: 0,
        }),
        supabase.rpc("list_discovery_blocks"),
        supabase.rpc("list_family_connections"),
      ]);
    if (error) discoveryError = true;
    else {
      const validated = parseMatchResults(data);
      if (validated.success) families = validated.data;
      else discoveryError = true;
    }
    const validatedBlocks = blockedFamilySchema
      .array()
      .safeParse(blockedResult.data);
    if (!blockedResult.error && validatedBlocks.success) {
      blockedFamilies = validatedBlocks.data;
    }
    const validatedConnections = parseConnectionResults(connectionsResult.data);
    if (!connectionsResult.error && validatedConnections.success) {
      for (const connection of validatedConnections.data) {
        connectionStates.set(connection.other_family_id, connection.status);
      }
    }
  }

  const reasonLabels = {
    children_similar_age: copy.reasonChildren,
    shared_culture: copy.reasonCulture,
    shared_language: copy.reasonLanguage,
    shared_interests: copy.reasonInterests,
    availability_overlap: copy.reasonAvailability,
    shared_origin_country: copy.reasonOrigin,
    nearby: copy.reasonNearby,
  } satisfies Record<MatchReason, string>;

  return (
    <main className="app-shell discovery-page">
      <ProductEventTracker event="discovery_opened" />
      <AppHeader active="discover" locale={locale} />
      <section className="discovery-hero">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <p>{copy.intro}</p>
        <p className="matching-method">{copy.deterministic}</p>
      </section>

      {!family.location ? (
        <LocationSetup
          locale={locale}
          initialCountry={family.country_of_residence}
          initialRadius={family.discovery_radius_km}
          countries={countriesResult.data ?? []}
          copy={copy}
        />
      ) : (
        <>
          <form className="discovery-filters">
            <h2>{copy.filters}</h2>
            <label>
              {copy.radius}
              <select
                name="radius"
                defaultValue={filters.radius ?? family.discovery_radius_km}
              >
                {[5, 10, 20, 30, 40, 50, 75, 100]
                  .filter((value) => value <= family.discovery_radius_km)
                  .map((value) => (
                    <option value={value} key={value}>
                      {value} km
                    </option>
                  ))}
              </select>
            </label>
            <label>
              {copy.country}
              <select name="country" defaultValue={filters.country ?? ""}>
                <option value="">{copy.all}</option>
                {(countriesResult.data ?? []).map((item) => (
                  <option value={item.iso2} key={item.iso2}>
                    {item.emoji} {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {copy.culture}
              <select name="culture" defaultValue={filters.culture ?? ""}>
                <option value="">{copy.all}</option>
                {(culturesResult.data ?? []).map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {copy.language}
              <select name="language" defaultValue={filters.language ?? ""}>
                <option value="">{copy.all}</option>
                {(languagesResult.data ?? []).map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {copy.interest}
              <select name="interest" defaultValue={filters.interest ?? ""}>
                <option value="">{copy.all}</option>
                {(interestsResult.data ?? []).map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.slug.replaceAll("-", " ")}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {copy.minAge}
              <input
                name="minAge"
                type="number"
                min="0"
                max="20"
                defaultValue={filters.minAge}
              />
            </label>
            <label>
              {copy.maxAge}
              <input
                name="maxAge"
                type="number"
                min="0"
                max="20"
                defaultValue={filters.maxAge}
              />
            </label>
            <label>
              {copy.availability}
              <select
                name="availability"
                defaultValue={
                  filters.weekday !== undefined && filters.period
                    ? `${filters.weekday}:${filters.period}`
                    : ""
                }
              >
                <option value="">{copy.anyAvailability}</option>
                {copy.days.flatMap((day, weekday) =>
                  (["morning", "afternoon", "evening"] as const).map(
                    (period) => (
                      <option
                        value={`${weekday}:${period}`}
                        key={`${weekday}:${period}`}
                      >
                        {day} · {copy.periods[period]}
                      </option>
                    ),
                  ),
                )}
              </select>
            </label>
            <div className="filter-actions">
              <button className="button button-primary">{copy.apply}</button>
              <Link
                className="button button-secondary"
                href={`/${locale}/app/discover`}
              >
                {copy.clear}
              </Link>
            </div>
          </form>
          {discoveryError && (
            <p className="form-error" role="alert">
              Discovery is temporarily unavailable.
            </p>
          )}
          {!discoveryError && families.length === 0 && (
            <div className="empty-discovery">
              <ShieldCheck />
              <p>{copy.noResults}</p>
            </div>
          )}
          <section className="discovery-grid" aria-live="polite">
            {families.map((item) => (
              <article className="family-card" key={item.family_id}>
                <div className="family-card-heading">
                  <div>
                    <p className="eyebrow">{item.distance_bucket}</p>
                    <h2>{item.family_name}</h2>
                  </div>
                  <span className="area">
                    <MapPin size={17} />
                    {item.display_city}
                  </span>
                </div>
                <div
                  className="match-score"
                  aria-label={`${item.match_score}% ${copy.compatibility}`}
                >
                  <strong>{item.match_score}%</strong>
                  <span>{copy.compatibility}</span>
                </div>
                <dl>
                  <div>
                    <dt>
                      <Baby size={17} />
                      {copy.childrenAges}
                    </dt>
                    <dd>{item.child_age_ranges.join(", ")}</dd>
                  </div>
                  <div>
                    <dt>
                      <Sparkles size={17} />
                      {copy.culture}
                    </dt>
                    <dd>{item.cultures.join(", ")}</dd>
                  </div>
                  <div>
                    <dt>
                      <Languages size={17} />
                      {copy.language}
                    </dt>
                    <dd>{item.languages.join(", ")}</dd>
                  </div>
                  {item.shared_interests.length > 0 && (
                    <div>
                      <dt>{copy.sharedInterests}</dt>
                      <dd>
                        {item.shared_interests
                          .map((value) => value.replaceAll("-", " "))
                          .join(", ")}
                      </dd>
                    </div>
                  )}
                </dl>
                <ul className="compatibility-reasons">
                  {item.compatibility_reasons.map((reason) => (
                    <li key={reason}>{reasonLabels[reason]}</li>
                  ))}
                </ul>
                <div className="family-card-actions">
                  <ConnectionRequestButton
                    familyId={item.family_id}
                    state={connectionStates.get(item.family_id)}
                    copy={copy}
                  />
                  <BlockFamilyButton familyId={item.family_id} copy={copy} />
                </div>
              </article>
            ))}
          </section>
          {blockedFamilies.length > 0 && (
            <details className="blocked-families">
              <summary>{copy.blockedFamilies}</summary>
              <ul>
                {blockedFamilies.map((item) => (
                  <li key={item.family_id}>
                    <span>{item.family_name}</span>
                    <UnblockFamilyButton
                      familyId={item.family_id}
                      copy={copy}
                    />
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </main>
  );
}
