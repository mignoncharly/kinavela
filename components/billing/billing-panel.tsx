"use client";

import { useState } from "react";

import {
  ROOTS_FAMILY_ANNUAL_SAVING_PERCENT,
  ROOTS_FAMILY_PRICING,
} from "@/lib/billing/pricing";
import type {
  BillingEntitlements,
  BillingPlan,
} from "@/lib/validation/billing";
import type { Locale } from "@/lib/i18n/config";
import { getAppDictionary } from "@/lib/i18n/app-copy";

function formatPrice(amountCents: number, locale: Locale) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
  }).format(amountCents / 100);
}

export function BillingPanel({
  initial,
  notice,
  locale,
}: {
  initial: BillingEntitlements;
  notice?: "success" | "cancelled";
  locale: Locale;
}) {
  const copy = getAppDictionary(locale).billing;
  const [busy, setBusy] = useState<BillingPlan | "portal" | null>(null);
  const [error, setError] = useState("");
  const hasAccess = initial.roots_stories_ai;
  const isPaymentIssue = initial.status === "past_due";
  const isEnding = initial.cancel_at_period_end;

  async function startCheckout(plan: BillingPlan) {
    setBusy(plan);
    setError("");
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = (await response.json()) as {
        url?: string;
        error?: string;
      };
      if (!response.ok || !data.url) {
        if (data.error === "subscription_already_exists") {
          await openPortal();
          return;
        }
        throw new Error("billing_unavailable");
      }
      window.location.assign(data.url);
    } catch {
      setError(copy.unavailable);
      setBusy(null);
    }
  }

  async function openPortal() {
    setBusy("portal");
    setError("");
    try {
      const response = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      const data = (await response.json()) as { url?: string };
      if (!response.ok || !data.url) throw new Error("portal_unavailable");
      window.location.assign(data.url);
    } catch {
      setError(copy.portalUnavailable);
      setBusy(null);
    }
  }

  return (
    <section className="billing-panel" aria-labelledby="billing-title">
      <p className="eyebrow">{copy.eyebrow}</p>
      <h2 id="billing-title">{hasAccess ? copy.active : copy.preserve}</h2>
      {notice === "success" && !hasAccess && (
        <p className="billing-notice" role="status">
          {copy.confirming}
        </p>
      )}
      {notice === "cancelled" && (
        <p className="billing-notice" role="status">
          {copy.cancelled}
        </p>
      )}
      <p>{copy.free}</p>
      {hasAccess ? (
        <>
          <p>{copy.includes}</p>
          <p className="billing-status">
            {copy.plan}:{" "}
            {initial.plan === "annual" ? copy.annual : copy.monthly} ·{" "}
            {copy.status}: {initial.status}
          </p>
          {isPaymentIssue && (
            <p className="billing-notice" role="status">
              {copy.paymentIssue}
            </p>
          )}
          {initial.current_period_end && (
            <p>
              {isEnding ? copy.until : copy.renewal}
              {new Date(initial.current_period_end).toLocaleDateString(locale)}
              {isEnding ? "." : ""}
            </p>
          )}
          <button
            className="billing-button secondary"
            disabled={busy !== null}
            onClick={openPortal}
          >
            {busy === "portal" ? copy.opening : copy.manage}
          </button>
        </>
      ) : (
        <>
          <div className="billing-plans" aria-label={copy.plans}>
            <div className="billing-plan">
              <h3>{copy.monthly}</h3>
              <p className="billing-price">
                {formatPrice(ROOTS_FAMILY_PRICING.monthly.amountCents, locale)}
                <span>{copy.perMonth}</span>
              </p>
              <button
                className="billing-button"
                disabled={busy !== null}
                onClick={() => startCheckout("monthly")}
              >
                {busy === "monthly" ? copy.opening : copy.chooseMonthly}
              </button>
            </div>
            <div className="billing-plan recommended">
              <p className="billing-recommended">{copy.recommended}</p>
              <h3>{copy.annual}</h3>
              <p className="billing-price">
                {formatPrice(ROOTS_FAMILY_PRICING.annual.amountCents, locale)}
                <span>{copy.perYear}</span>
              </p>
              <p>
                {copy.save.replace(
                  "{percent}",
                  String(ROOTS_FAMILY_ANNUAL_SAVING_PERCENT),
                )}
              </p>
              <button
                className="billing-button"
                disabled={busy !== null}
                onClick={() => startCheckout("annual")}
              >
                {busy === "annual" ? copy.opening : copy.chooseAnnual}
              </button>
            </div>
          </div>
          <p className="billing-cancellation">{copy.cancellation}</p>
        </>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
