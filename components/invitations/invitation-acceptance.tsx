"use client";

import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { getInvitationCopy } from "@/features/invitations/copy";
import type { Locale } from "@/lib/i18n/config";

const errorKeys = {
  geographic_eligibility_required: "geoError",
  village_full: "fullError",
  owner_required: "ownerError",
  membership_already_exists: "membershipError",
  invalid_invitation: "unavailableError",
  invitation_not_available: "unavailableError",
  event_not_available: "unavailableError",
  village_not_available: "unavailableError",
} as const;

export function InvitationAcceptance({
  locale,
  token,
  invitationKind,
}: {
  locale: Locale;
  token: string;
  invitationKind: "family_referral" | "village";
}) {
  const copy = getInvitationCopy(locale);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function accept() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/invitations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: invitationKind === "village" ? "accept_village" : "attribute",
          token,
        }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        error?: string;
        destination?: { village_id: string; event_id: string | null };
      };
      if (!response.ok || !result.ok) {
        const key = errorKeys[result.error as keyof typeof errorKeys];
        setError(key ? copy[key] : copy.actionError);
        return;
      }
      if (result.destination) {
        const base = `/${locale}/app/villages/${result.destination.village_id}`;
        router.push(
          result.destination.event_id
            ? `${base}?tab=events#event-${result.destination.event_id}`
            : base,
        );
      } else {
        router.push(`/${locale}/app`);
      }
      router.refresh();
    } catch {
      setError(copy.actionError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="invitation-acceptance">
      {invitationKind === "village" && <p>{copy.acceptConsent}</p>}
      <button
        className="button button-primary"
        disabled={busy}
        type="button"
        onClick={() => void accept()}
      >
        {invitationKind === "village" ? (
          <CheckCircle2 size={18} />
        ) : (
          <ArrowRight size={18} />
        )}
        {busy
          ? copy.accepting
          : invitationKind === "village"
            ? copy.accept
            : copy.continueApp}
      </button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
