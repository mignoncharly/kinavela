"use client";

import {
  Bell,
  BellOff,
  MapPin,
  Search,
  Share2,
  Sparkles,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { getDiscoveryActivationCopy } from "@/features/discovery-activation/copy";
import type { DiscoveryAlert } from "@/features/discovery-activation/results";
import type { Locale } from "@/lib/i18n/config";

type VillageSuggestion = {
  village_id: string;
  name: string;
  city: string;
  member_count: number;
};

type ClusterSuggestion = {
  country_id: string;
  country_name: string;
  family_count: number;
};

export function DiscoveryEmptyState({
  locale,
  city,
  currentRadius,
  maximumRadius,
  nextRadius,
  increaseHref,
  widerHref,
  clearHref,
  hasAdditionalFilters,
  broaderFamilyCount,
  villages,
  clusters,
  initialAlert,
  canManageAlert,
}: {
  locale: Locale;
  city: string;
  currentRadius: number;
  maximumRadius: number;
  nextRadius: number | null;
  increaseHref: string;
  widerHref: string;
  clearHref: string;
  hasAdditionalFilters: boolean;
  broaderFamilyCount: number;
  villages: VillageSuggestion[];
  clusters: ClusterSuggestion[];
  initialAlert: DiscoveryAlert | null;
  canManageAlert: boolean;
}) {
  const copy = getDiscoveryActivationCopy(locale);
  const router = useRouter();
  const [alert, setAlert] = useState(initialAlert);
  const [radius, setRadius] = useState(
    initialAlert?.radius_km ?? maximumRadius,
  );
  const [busy, setBusy] = useState<"subscribe" | "revoke" | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState(false);
  const radiusOptions = [5, 10, 20, 30, 40, 50, 75, 100].filter(
    (value) => value <= maximumRadius,
  );
  if (!radiusOptions.includes(maximumRadius)) radiusOptions.push(maximumRadius);
  radiusOptions.sort((left, right) => left - right);

  async function subscribe() {
    setBusy("subscribe");
    setError(false);
    setNotice("");
    try {
      const response = await fetch("/api/discovery/alerts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "subscribe", radius_km: radius }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        subscription_id?: string;
      };
      if (!response.ok || !result.ok || !result.subscription_id)
        throw new Error("alert_failed");
      setAlert({
        subscription_id: result.subscription_id,
        active: true,
        radius_km: radius,
        last_evaluated_at: alert?.last_evaluated_at ?? null,
        created_at: alert?.created_at ?? new Date().toISOString(),
      });
      setNotice(copy.alertSaved);
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(null);
    }
  }

  async function revoke() {
    setBusy("revoke");
    setError(false);
    setNotice("");
    try {
      const response = await fetch("/api/discovery/alerts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "revoke" }),
      });
      if (!response.ok) throw new Error("alert_failed");
      setAlert((current) => (current ? { ...current, active: false } : null));
      setNotice(copy.alertRevoked);
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section
      className="discovery-activation"
      aria-labelledby="discovery-empty-title"
    >
      <header className="discovery-activation-heading">
        <Search />
        <div>
          <h2 id="discovery-empty-title">{copy.title}</h2>
          <p>{copy.body}</p>
          {broaderFamilyCount > 0 && (
            <p className="discovery-broader-signal">
              {copy.broaderFound.replace("{count}", String(broaderFamilyCount))}
            </p>
          )}
        </div>
      </header>

      <div className="discovery-next-actions">
        {nextRadius && (
          <Link className="button button-primary" href={increaseHref}>
            <MapPin size={17} />
            {copy.increaseRadius.replace("{radius}", String(nextRadius))}
          </Link>
        )}
        {currentRadius < maximumRadius && (
          <Link className="button button-secondary" href={widerHref}>
            <Search size={17} />
            {copy.widerRegion.replace("{radius}", String(maximumRadius))}
          </Link>
        )}
        {hasAdditionalFilters && (
          <Link className="button button-secondary" href={clearHref}>
            {copy.clearFilters}
          </Link>
        )}
        <Link
          className="button button-secondary"
          href={`/${locale}/app/villages`}
        >
          <Users size={17} /> {copy.villages}
        </Link>
        <Link
          className="button button-secondary"
          href={`/${locale}/app/villages#create-village`}
        >
          <Sparkles size={17} /> {copy.createVillage}
        </Link>
        <Link
          className="button button-secondary"
          href={`/${locale}/app/settings#family-referral`}
        >
          <Share2 size={17} /> {copy.inviteFamily}
        </Link>
      </div>

      {canManageAlert && (
        <section className="discovery-alert-panel">
          <Bell />
          <div>
            <h3>{copy.alertTitle}</h3>
            <p>{copy.alertBody}</p>
            {alert?.active && (
              <strong>
                {copy.alertActive.replace("{radius}", String(alert.radius_km))}
              </strong>
            )}
            <div className="discovery-alert-controls">
              <label>
                {copy.alertRadius}
                <select
                  value={radius}
                  onChange={(event) => setRadius(Number(event.target.value))}
                >
                  {radiusOptions.map((value) => (
                    <option value={value} key={value}>
                      {value} km
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="button button-primary"
                disabled={busy !== null}
                type="button"
                onClick={() => void subscribe()}
              >
                <Bell size={17} />
                {busy === "subscribe"
                  ? copy.alertEnabling
                  : alert?.active
                    ? copy.alertUpdate
                    : copy.alertEnable}
              </button>
              {alert?.active && (
                <button
                  className="button button-secondary"
                  disabled={busy !== null}
                  type="button"
                  onClick={() => void revoke()}
                >
                  <BellOff size={17} />
                  {busy === "revoke" ? copy.alertRevoking : copy.alertRevoke}
                </button>
              )}
            </div>
            <small>{copy.alertPrivacy}</small>
            {notice && (
              <p className="form-success" role="status">
                {notice}
              </p>
            )}
            {error && (
              <p className="form-error" role="alert">
                {copy.alertError}
              </p>
            )}
          </div>
        </section>
      )}
      {!canManageAlert && (
        <p className="discovery-alert-owner-note">{copy.ownerOnly}</p>
      )}

      {villages.length > 0 && (
        <section className="discovery-regional-panel">
          <h3>{copy.nearbyVillagesTitle}</h3>
          <p>{copy.nearbyVillagesBody}</p>
          <div className="discovery-suggestion-grid">
            {villages.map((village) => (
              <Link
                href={`/${locale}/app/villages`}
                className="discovery-suggestion-card"
                key={village.village_id}
              >
                <MapPin />
                <strong>{village.name}</strong>
                <span>{village.city}</span>
                <small>
                  {copy.villageMembers.replace(
                    "{count}",
                    String(village.member_count),
                  )}
                </small>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="discovery-cultural-panel">
        <Sparkles />
        <div>
          <h3>{copy.clusterTitle}</h3>
          {clusters.length > 0 ? (
            clusters.map((cluster) => (
              <p key={cluster.country_id}>
                {copy.clusterBody.replace("{country}", cluster.country_name)} (
                {cluster.family_count})
              </p>
            ))
          ) : (
            <p>{copy.clusterGeneric.replace("{city}", city)}</p>
          )}
        </div>
      </section>
    </section>
  );
}
