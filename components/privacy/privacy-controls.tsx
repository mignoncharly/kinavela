"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n/config";
import { getAppDictionary } from "@/lib/i18n/app-copy";

type ExportItem = { export_id: string; status: string };

export function PrivacyControls({ locale }: { locale: Locale }) {
  const copy = getAppDictionary(locale).privacyControls;
  const [productEmail, setProductEmail] = useState(false);
  const [exports, setExports] = useState<ExportItem[]>([]);
  const [message, setMessage] = useState("");
  useEffect(() => {
    void Promise.all([
      fetch("/api/privacy/consents").then((r) => r.json()),
      fetch("/api/privacy/export").then((r) => r.json()),
    ])
      .then(([consent, exportResult]) => {
        const item = consent.consents?.find(
          (value: { consent_type: string; revoked_at: string | null }) =>
            value.consent_type === "product_email",
        );
        setProductEmail(Boolean(item && !item.revoked_at));
        setExports(exportResult.exports ?? []);
      })
      .catch(() => setMessage(copy.unavailable));
  }, [copy.unavailable]);
  async function setConsent(enabled: boolean) {
    setProductEmail(enabled);
    const response = await fetch("/api/privacy/consents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ product_email: enabled }),
    });
    setMessage(response.ok ? copy.saved : copy.saveFailed);
  }
  async function requestExport() {
    const response = await fetch("/api/privacy/export", { method: "POST" });
    if (!response.ok) return setMessage(copy.requestFailed);
    setMessage(copy.requested);
    const result = await fetch("/api/privacy/export").then((r) => r.json());
    setExports(result.exports ?? []);
  }
  return (
    <section className="privacy-controls">
      <h3>{copy.title}</h3>
      <label>
        <input
          type="checkbox"
          checked={productEmail}
          onChange={(event) => void setConsent(event.target.checked)}
        />{" "}
        {copy.productEmail}
      </label>
      <button
        className="button button-secondary"
        type="button"
        onClick={() => void requestExport()}
      >
        {copy.requestExport}
      </button>
      {exports
        .filter((item) => item.status === "ready")
        .map((item) => (
          <a
            className="privacy-export-link"
            href={`/api/privacy/exports/${item.export_id}`}
            key={item.export_id}
          >
            {copy.download}
          </a>
        ))}
      {message && <p role="status">{message}</p>}
      <small>{copy.note}</small>
    </section>
  );
}
