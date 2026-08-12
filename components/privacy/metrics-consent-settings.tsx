"use client";

import { useState, useSyncExternalStore } from "react";

import type { Locale } from "@/lib/i18n/config";

const copy = {
  de: {
    accept: "Produktmetriken erlauben",
    decline: "Produktmetriken ablehnen",
    saved: "Gespeichert.",
  },
  fr: {
    accept: "Autoriser les métriques produit",
    decline: "Refuser les métriques produit",
    saved: "Enregistré.",
  },
  en: {
    accept: "Allow product metrics",
    decline: "Decline product metrics",
    saved: "Saved.",
  },
} satisfies Record<Locale, Record<"accept" | "decline" | "saved", string>>;

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

export function MetricsConsentSettings({ locale }: { locale: Locale }) {
  const value = useSyncExternalStore(
    subscribe,
    getConsentSnapshot,
    getServerConsentSnapshot,
  );
  const [saved, setSaved] = useState(false);

  function update(next: "granted" | "denied") {
    window.localStorage.setItem(consentStorageKey, next);
    setSaved(true);
    window.dispatchEvent(new Event("kinavela-consent-changed"));
  }

  return (
    <div className="metrics-consent-settings">
      <button
        className="button button-secondary"
        type="button"
        onClick={() => update("granted")}
      >
        {copy[locale].accept}
      </button>{" "}
      <button
        className="button button-secondary"
        type="button"
        onClick={() => update("denied")}
      >
        {copy[locale].decline}
      </button>
      <span aria-live="polite">
        {saved ? copy[locale].saved : value ? " " : ""}
      </span>
    </div>
  );
}
