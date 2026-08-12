"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { clearOfflineSnapshots } from "@/components/pwa/offline-data";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaRuntime() {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(
    null,
  );
  useEffect(() => {
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    const onInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onInstall);
    window.addEventListener("appinstalled", () => setInstallEvent(null));
    return () => window.removeEventListener("beforeinstallprompt", onInstall);
  }, []);
  if (!installEvent) return null;
  async function install() {
    await installEvent?.prompt();
    setInstallEvent(null);
  }
  return (
    <aside className="pwa-install-prompt" aria-label="Install Kinavela">
      <strong>Install Kinavela</strong>
      <span>Keep your family space close, even with a weak connection.</span>
      <button className="button button-primary" type="button" onClick={install}>
        Install
      </button>
      <button
        className="pwa-dismiss"
        type="button"
        onClick={() => setInstallEvent(null)}
      >
        Not now
      </button>
    </aside>
  );
}

export function OfflineLink() {
  return (
    <Link className="button button-secondary" href="/offline">
      Offline space
    </Link>
  );
}

export { clearOfflineSnapshots };
