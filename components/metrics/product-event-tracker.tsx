"use client";

import { useEffect } from "react";

export function ProductEventTracker({
  event,
}: {
  event: "app_session_started" | "discovery_opened";
}) {
  useEffect(() => {
    function track() {
      if (window.localStorage.getItem("kinavela:metrics-consent") !== "granted")
        return;
      const key = "kinavela:" + event;
      if (event === "app_session_started" && sessionStorage.getItem(key))
        return;
      if (event === "app_session_started") sessionStorage.setItem(key, "1");
      void fetch("/api/metrics/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ event }),
      });
    }

    track();
    window.addEventListener("kinavela-consent-changed", track);
    return () => window.removeEventListener("kinavela-consent-changed", track);
  }, [event]);

  return null;
}
