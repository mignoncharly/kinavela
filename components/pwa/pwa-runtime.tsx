"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { clearOfflineSnapshots } from "@/components/pwa/offline-data";
import { getAppDictionary } from "@/lib/i18n/app-copy";
import { isLocale } from "@/lib/i18n/config";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaRuntime() {
  const pathname = usePathname();
  const segment = pathname?.split("/")[1] ?? "de";
  const locale = isLocale(segment) ? segment : "de";
  const copy = getAppDictionary(locale).pwa;
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
    <aside className="pwa-install-prompt" aria-label={copy.installLabel}>
      <strong>{copy.installLabel}</strong>
      <span>{copy.installBody}</span>
      <button className="button button-primary" type="button" onClick={install}>
        {copy.install}
      </button>
      <button
        className="pwa-dismiss"
        type="button"
        onClick={() => setInstallEvent(null)}
      >
        {copy.notNow}
      </button>
    </aside>
  );
}

export function OfflineLink({ locale }: { locale: "de" | "fr" | "en" }) {
  const copy = getAppDictionary(locale).pwa;
  return (
    <Link
      className="button button-secondary"
      href={`/offline?locale=${locale}`}
    >
      {copy.offlineSpace}
    </Link>
  );
}

export { clearOfflineSnapshots };
