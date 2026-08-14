"use client";

import { Bell, BellOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { getDiscoveryActivationCopy } from "@/features/discovery-activation/copy";
import type { DiscoveryAlert } from "@/features/discovery-activation/results";
import type { Locale } from "@/lib/i18n/config";

export function DiscoveryAlertStatus({
  locale,
  maximumRadius,
  initialAlert,
}: {
  locale: Locale;
  maximumRadius: number;
  initialAlert: DiscoveryAlert;
}) {
  const copy = getDiscoveryActivationCopy(locale);
  const router = useRouter();
  const [radius, setRadius] = useState(initialAlert.radius_km);
  const [busy, setBusy] = useState<"update" | "revoke" | null>(null);
  const [error, setError] = useState(false);
  const options = [5, 10, 20, 30, 40, 50, 75, 100]
    .filter((value) => value <= maximumRadius)
    .concat([maximumRadius])
    .filter((value, index, values) => values.indexOf(value) === index)
    .sort((left, right) => left - right);

  async function act(action: "update" | "revoke") {
    setBusy(action);
    setError(false);
    try {
      const response = await fetch("/api/discovery/alerts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          action === "update"
            ? { action: "subscribe", radius_km: radius }
            : { action: "revoke" },
        ),
      });
      if (!response.ok) throw new Error("alert_failed");
      setBusy(null);
      router.refresh();
    } catch {
      setError(true);
      setBusy(null);
    }
  }

  return (
    <section className="discovery-alert-status">
      <Bell />
      <div>
        <strong>
          {copy.alertActive.replace("{radius}", String(initialAlert.radius_km))}
        </strong>
        <small>{copy.alertPrivacy}</small>
      </div>
      <label>
        {copy.alertRadius}
        <select
          value={radius}
          onChange={(event) => setRadius(Number(event.target.value))}
        >
          {options.map((value) => (
            <option value={value} key={value}>
              {value} km
            </option>
          ))}
        </select>
      </label>
      <button
        className="button button-secondary"
        disabled={busy !== null}
        type="button"
        onClick={() => void act("update")}
      >
        {busy === "update" ? copy.alertEnabling : copy.alertUpdate}
      </button>
      <button
        className="button button-secondary"
        disabled={busy !== null}
        type="button"
        onClick={() => void act("revoke")}
      >
        <BellOff size={17} />
        {busy === "revoke" ? copy.alertRevoking : copy.alertRevoke}
      </button>
      {error && (
        <p className="form-error" role="alert">
          {copy.alertError}
        </p>
      )}
    </section>
  );
}
