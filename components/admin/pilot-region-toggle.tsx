"use client";

import { useState } from "react";

export function PilotRegionToggle({
  city,
  status,
}: {
  city: string;
  status: "waitlist" | "open" | "paused";
}) {
  const [busy, setBusy] = useState(false);
  const next = status === "open" ? "paused" : "open";
  return (
    <button
      className="button button-secondary"
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/admin/pilot-region", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ city, status: next }),
        });
        window.location.reload();
      }}
    >
      {busy ? "Saving…" : next === "open" ? "Open" : "Pause"}
    </button>
  );
}
