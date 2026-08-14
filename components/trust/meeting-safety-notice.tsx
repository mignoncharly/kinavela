"use client";

import { ShieldAlert } from "lucide-react";
import { useState } from "react";

import { getTrustCopy } from "@/features/trust/copy";
import type { Locale } from "@/lib/i18n/config";

export function MeetingSafetyNotice({
  locale,
  busy = false,
  onConfirm,
}: {
  locale: Locale;
  busy?: boolean;
  onConfirm: () => Promise<void>;
}) {
  const t = getTrustCopy(locale);
  const [acknowledged, setAcknowledged] = useState(false);
  return (
    <section className="meeting-safety-notice">
      <h4>
        <ShieldAlert size={19} /> {t.safetyTitle}
      </h4>
      <p>{t.safetyIntro}</p>
      <ul>
        {t.safetyItems.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <label>
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(event) => setAcknowledged(event.target.checked)}
        />{" "}
        {t.safetyAcknowledge}
      </label>
      <button
        className="button button-primary"
        type="button"
        disabled={!acknowledged || busy}
        onClick={() => void onConfirm()}
      >
        {busy ? t.sending : t.safetyContinue}
      </button>
    </section>
  );
}
