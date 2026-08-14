"use client";

import { Ban, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  CitySearch,
  type CitySearchCopy,
} from "@/components/discovery/city-search";
import type { Locale } from "@/lib/i18n/config";

type ActionCopy = CitySearchCopy & {
  locationTitle: string;
  locationBody: string;
  radius: string;
  save: string;
  saving: string;
  block: string;
  blocking: string;
  unblock: string;
  unblocking: string;
};

export function LocationSetup({
  locale,
  initialRadius,
  countries,
  copy,
}: {
  locale: Locale;
  initialCountry: string;
  initialRadius: number;
  countries: { iso2: string; name: string; emoji: string }[];
  copy: ActionCopy;
}) {
  const router = useRouter();
  const country = "DE";
  const [radius, setRadius] = useState(initialRadius);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  return (
    <section className="location-setup">
      <ShieldCheck size={28} />
      <div>
        <h2>{copy.locationTitle}</h2>
        <p>{copy.locationBody}</p>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const placeId = String(form.get("locationPlaceId") ?? "");
            if (!placeId) {
              setError(copy.noCities);
              return;
            }
            setBusy(true);
            setError("");
            const response = await fetch("/api/location", {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                location_place_id: placeId,
                radius_km: radius,
              }),
            });
            if (response.ok) {
              router.refresh();
              return;
            }
            const body = (await response.json()) as { error?: string };
            setError(
              body.error === "invalid_location"
                ? copy.invalidLocation
                : body.error === "germany_location_required"
                  ? copy.germanyOnly
                  : body.error === "not_authenticated"
                    ? copy.authenticationRequired
                    : copy.validationFailed,
            );
            setBusy(false);
          }}
        >
          <label>
            Country
            <select value={country} disabled>
              {countries
                .filter((item) => item.iso2 === "DE")
                .map((item) => (
                  <option value={item.iso2} key={item.iso2}>
                    {item.emoji} {item.name}
                  </option>
                ))}
            </select>
          </label>
          <CitySearch
            key={country}
            country={country}
            locale={locale}
            copy={copy}
          />
          <label>
            {copy.radius}: <output>{radius} km</output>
            <input
              type="range"
              min="5"
              max="100"
              step="5"
              value={radius}
              onChange={(event) => setRadius(Number(event.target.value))}
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="button button-primary" disabled={busy}>
            {busy ? copy.saving : copy.save}
          </button>
        </form>
      </div>
    </section>
  );
}

export function BlockFamilyButton({
  familyId,
  copy,
}: {
  familyId: string;
  copy: Pick<ActionCopy, "block" | "blocking">;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="block-family"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const response = await fetch("/api/discovery/block", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ family_id: familyId, blocked: true }),
        });
        if (response.ok) router.refresh();
        else setBusy(false);
      }}
    >
      <Ban size={16} /> {busy ? copy.blocking : copy.block}
    </button>
  );
}

export function UnblockFamilyButton({
  familyId,
  copy,
}: {
  familyId: string;
  copy: Pick<ActionCopy, "unblock" | "unblocking">;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="block-family"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const response = await fetch("/api/discovery/block", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ family_id: familyId, blocked: false }),
        });
        if (response.ok) router.refresh();
        else setBusy(false);
      }}
    >
      {busy ? copy.unblocking : copy.unblock}
    </button>
  );
}
