"use client";

import { useEffect, useState } from "react";

type ExportItem = { export_id: string; status: string };

export function PrivacyControls() {
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
      .catch(() => setMessage("Privacy controls are temporarily unavailable."));
  }, []);
  async function setConsent(enabled: boolean) {
    setProductEmail(enabled);
    const response = await fetch("/api/privacy/consents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ product_email: enabled }),
    });
    setMessage(
      response.ok
        ? "Consent preference saved."
        : "Could not save consent preference.",
    );
  }
  async function requestExport() {
    const response = await fetch("/api/privacy/export", { method: "POST" });
    if (!response.ok) return setMessage("Could not request your data export.");
    setMessage("Export requested. Refresh this page when it is ready.");
    const result = await fetch("/api/privacy/export").then((r) => r.json());
    setExports(result.exports ?? []);
  }
  return (
    <section className="privacy-controls">
      <h3>Privacy controls</h3>
      <label>
        <input
          type="checkbox"
          checked={productEmail}
          onChange={(event) => void setConsent(event.target.checked)}
        />{" "}
        Receive optional product emails
      </label>
      <button
        className="button button-secondary"
        type="button"
        onClick={() => void requestExport()}
      >
        Request a copy of my data
      </button>
      {exports
        .filter((item) => item.status === "ready")
        .map((item) => (
          <a
            className="privacy-export-link"
            href={`/api/privacy/exports/${item.export_id}`}
            key={item.export_id}
          >
            Download ready export
          </a>
        ))}
      {message && <p role="status">{message}</p>}
      <small>
        Exports expire after seven days. Media is removed during the protected
        account deletion workflow.
      </small>
    </section>
  );
}
