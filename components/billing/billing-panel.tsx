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

function formatPrice(amountCents: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amountCents / 100);
}

function planLabel(plan: BillingPlan | "free") {
  return plan === "annual" ? "Annual" : "Monthly";
}

export function BillingPanel({
  initial,
  notice,
}: {
  initial: BillingEntitlements;
  notice?: "success" | "cancelled";
}) {
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
      setError("Billing is temporarily unavailable. Please try again.");
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
      setError("The customer portal is temporarily unavailable.");
      setBusy(null);
    }
  }

  return (
    <section className="billing-panel" aria-labelledby="billing-title">
      <p className="eyebrow">ROOTS FAMILY</p>
      <h2 id="billing-title">
        {hasAccess ? "Roots Family is active" : "Preserve more of what matters"}
      </h2>
      {notice === "success" && !hasAccess && (
        <p className="billing-notice" role="status">
          Your subscription is being confirmed. This can take a moment.
        </p>
      )}
      {notice === "cancelled" && (
        <p className="billing-notice" role="status">
          No payment was made. Your current Kinavela access remains unchanged.
        </p>
      )}
      <p>
        Community access stays free: family discovery, connections, messaging,
        Villages, events and basic Roots Passport remain available to everyone.
      </p>
      {hasAccess ? (
        <>
          <p>
            Roots Family includes the existing Roots Stories AI workflow:
            transcription, translation and child-friendly story adaptation, with
            configurable monthly usage limits.
          </p>
          <p className="billing-status">
            Plan: {planLabel(initial.plan)} · Status: {initial.status}
          </p>
          {isPaymentIssue && (
            <p className="billing-notice" role="status">
              Payment issue: please update your payment method in the billing
              portal.
            </p>
          )}
          {initial.current_period_end && (
            <p>
              {isEnding ? "Access remains active until " : "Next renewal: "}
              {new Date(initial.current_period_end).toLocaleDateString("de-DE")}
              {isEnding ? "." : ""}
            </p>
          )}
          <button
            className="billing-button secondary"
            disabled={busy !== null}
            onClick={openPortal}
          >
            {busy === "portal" ? "Opening…" : "Manage subscription"}
          </button>
        </>
      ) : (
        <>
          <div className="billing-plans" aria-label="Roots Family plans">
            <div className="billing-plan">
              <h3>Monthly</h3>
              <p className="billing-price">
                {formatPrice(ROOTS_FAMILY_PRICING.monthly.amountCents)}
                <span>/month</span>
              </p>
              <button
                className="billing-button"
                disabled={busy !== null}
                onClick={() => startCheckout("monthly")}
              >
                {busy === "monthly" ? "Opening…" : "Choose monthly"}
              </button>
            </div>
            <div className="billing-plan recommended">
              <p className="billing-recommended">Recommended</p>
              <h3>Annual</h3>
              <p className="billing-price">
                {formatPrice(ROOTS_FAMILY_PRICING.annual.amountCents)}
                <span>/year</span>
              </p>
              <p>Save {ROOTS_FAMILY_ANNUAL_SAVING_PERCENT}%</p>
              <button
                className="billing-button"
                disabled={busy !== null}
                onClick={() => startCheckout("annual")}
              >
                {busy === "annual" ? "Opening…" : "Choose annual"}
              </button>
            </div>
          </div>
          <p className="billing-cancellation">
            Subscriptions renew automatically. You can cancel at any time in the
            Stripe customer portal and keep access through the paid period.
          </p>
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
