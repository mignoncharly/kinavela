"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

import { isLocale, type Locale } from "@/lib/i18n/config";

const copy = {
  de: {
    title: "Privatsphäre-Einstellungen",
    body: "Optionale Produktmetriken helfen uns, Kinavela zu verbessern. Sie können ablehnen; der Dienst bleibt vollständig nutzbar.",
    accept: "Erlauben",
    decline: "Ablehnen",
  },
  fr: {
    title: "Paramètres de confidentialité",
    body: "Les métriques produit facultatives nous aident à améliorer Kinavela. Vous pouvez refuser sans perdre l’accès au service.",
    accept: "Autoriser",
    decline: "Refuser",
  },
  en: {
    title: "Privacy settings",
    body: "Optional product metrics help us improve Kinavela. You can decline and continue using the full service.",
    accept: "Allow",
    decline: "Decline",
  },
} satisfies Record<
  Locale,
  Record<"title" | "body" | "accept" | "decline", string>
>;

const consentStorageKey = "kinavela:metrics-consent";

function subscribe(onStoreChange: () => void) {
  window.addEventListener("kinavela-consent-changed", onStoreChange);
  return () =>
    window.removeEventListener("kinavela-consent-changed", onStoreChange);
}

function getConsentSnapshot() {
  return window.localStorage.getItem(consentStorageKey);
}

function getServerConsentSnapshot() {
  return null;
}

export function MetricsConsentBanner() {
  const pathname = usePathname();
  const segment = pathname?.split("/")[1] ?? "de";
  const locale: Locale = isLocale(segment) ? segment : "de";
  const consent = useSyncExternalStore(
    subscribe,
    getConsentSnapshot,
    getServerConsentSnapshot,
  );
  const visible = consent === null;

  function update(next: "granted" | "denied") {
    window.localStorage.setItem(consentStorageKey, next);
    window.dispatchEvent(new Event("kinavela-consent-changed"));
  }

  if (!visible) return null;
  const text = copy[locale];
  return (
    <aside className="metrics-consent-banner" aria-label={text.title}>
      <strong>{text.title}</strong>
      <p>{text.body}</p>
      <div>
        <button
          className="button button-primary"
          type="button"
          onClick={() => update("granted")}
        >
          {text.accept}
        </button>
        <button
          className="button button-secondary"
          type="button"
          onClick={() => update("denied")}
        >
          {text.decline}
        </button>
      </div>
    </aside>
  );
}
