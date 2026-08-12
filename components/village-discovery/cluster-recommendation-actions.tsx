"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { VillageClusterRecommendation } from "@/features/village-discovery/results";
import type { Locale } from "@/lib/i18n/config";

type VillageCopy = (typeof import("@/messages/en.json"))["villages"];

function fillTemplate(
  template: string,
  recommendation: VillageClusterRecommendation,
) {
  return template
    .replace("{country}", recommendation.country_name)
    .replace("{city}", recommendation.city);
}

export function ClusterRecommendationActions({
  recommendation,
  locale,
  copy,
}: {
  recommendation: VillageClusterRecommendation;
  locale: Locale;
  copy: VillageCopy;
}) {
  const router = useRouter();
  const [busyAction, setBusyAction] = useState<"start" | "dismiss" | null>(
    null,
  );
  const [error, setError] = useState(false);

  async function act(action: "start" | "dismiss") {
    setBusyAction(action);
    setError(false);
    const body =
      action === "start"
        ? {
            action,
            country_id: recommendation.country_id,
            name: fillTemplate(copy.clusterSuggestedName, recommendation),
            description: fillTemplate(
              copy.clusterSuggestedDescription,
              recommendation,
            ),
          }
        : { action, country_id: recommendation.country_id };
    const response = await fetch("/api/villages/recommendations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload: unknown = await response.json().catch(() => null);
    const villageId =
      payload &&
      typeof payload === "object" &&
      "villageId" in payload &&
      typeof payload.villageId === "string"
        ? payload.villageId
        : null;
    if (response.ok && action === "start" && villageId) {
      router.push(`/${locale}/app/villages/${villageId}`);
      return;
    }
    if (response.ok && action === "dismiss") {
      router.refresh();
      return;
    }
    setBusyAction(null);
    setError(true);
  }

  return (
    <div>
      <div className="inline-actions cluster-actions">
        <button
          className="button button-primary"
          disabled={busyAction !== null}
          type="button"
          onClick={() => act("start")}
        >
          {busyAction === "start" ? copy.clusterStarting : copy.clusterStart}
        </button>
        <button
          className="button button-secondary"
          disabled={busyAction !== null}
          type="button"
          onClick={() => act("dismiss")}
        >
          {busyAction === "dismiss"
            ? copy.clusterDismissing
            : copy.clusterDismiss}
        </button>
      </div>
      {error && (
        <small className="form-error" role="alert">
          {copy.actionError}
        </small>
      )}
    </div>
  );
}
