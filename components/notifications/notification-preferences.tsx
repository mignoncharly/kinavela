"use client";

import { useEffect, useState } from "react";

import { publicEnv } from "@/lib/env.public";
import type { NotificationPreferences } from "@/lib/validation/notifications";
import type { Locale } from "@/lib/i18n/config";
import { getAppDictionary } from "@/lib/i18n/app-copy";

function applicationServerKey(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const decoded = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

function subscriptionInput(subscription: PushSubscription) {
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
    throw new Error("Incomplete push subscription");
  }
  return {
    action: "register" as const,
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
  };
}

export function NotificationPreferencesForm({
  initial,
  locale,
}: {
  initial: NotificationPreferences;
  locale: Locale;
}) {
  const copy = getAppDictionary(locale).notifications;
  const [email, setEmail] = useState(initial.email_enabled);
  const [push, setPush] = useState(initial.push_enabled);
  const [categories, setCategories] = useState({
    community_enabled: initial.community_enabled,
    events_enabled: initial.events_enabled,
    direct_enabled: initial.direct_enabled,
    heritage_enabled: initial.heritage_enabled,
    safety_enabled: initial.safety_enabled,
  });
  const [subscriptionCount, setSubscriptionCount] = useState(
    initial.push_subscription_count,
  );
  const [subscription, setSubscription] = useState<PushSubscription | null>(
    null,
  );
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then(setSubscription)
      .catch(() => undefined);
  }, []);

  async function save(
    nextEmail = email,
    nextPush = push,
    nextCategories = categories,
  ) {
    const response = await fetch("/api/notifications/preferences", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email_enabled: nextEmail,
        push_enabled: nextPush,
        ...nextCategories,
      }),
    });
    setMessage(response.ok ? copy.saved : copy.saveFailed);
  }

  async function enablePush() {
    if (
      !publicEnv.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY ||
      !("Notification" in window) ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      setMessage(copy.pushUnavailable);
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMessage(copy.permissionDenied);
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const nextSubscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey(
            publicEnv.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY,
          ),
        }));

      const response = await fetch("/api/notifications/push", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(subscriptionInput(nextSubscription)),
      });
      if (!response.ok) throw new Error("Could not register push subscription");

      setSubscription(nextSubscription);
      setSubscriptionCount((count) => Math.max(1, count));
      setPush(true);
      setMessage(copy.enabled);
    } catch {
      setMessage(copy.enableFailed);
    } finally {
      setBusy(false);
    }
  }

  async function disablePush() {
    if (!subscription) return;

    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/notifications/push", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "revoke",
          endpoint: subscription.endpoint,
        }),
      });
      if (!response.ok) throw new Error("Could not revoke push subscription");

      await subscription.unsubscribe();
      const nextCount = Math.max(0, subscriptionCount - 1);
      setSubscription(null);
      setSubscriptionCount(nextCount);
      setPush(nextCount > 0);
      setMessage(copy.disabled);
    } catch {
      setMessage(copy.disableFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="notification-preferences">
      <h2>{copy.title}</h2>
      <label>
        <input
          type="checkbox"
          checked={email}
          onChange={(event) => {
            setEmail(event.target.checked);
            void save(event.target.checked, push);
          }}
        />{" "}
        {copy.email}
      </label>
      <fieldset className="notification-category-preferences">
        <legend>{copy.categories}</legend>
        {(
          [
            ["community_enabled", copy.community],
            ["events_enabled", copy.events],
            ["direct_enabled", copy.direct],
            ["heritage_enabled", copy.heritage],
            ["safety_enabled", copy.safety],
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={categories[key]}
              onChange={(event) => {
                const next = { ...categories, [key]: event.target.checked };
                setCategories(next);
                void save(email, push, next);
              }}
            />{" "}
            {label}
          </label>
        ))}
      </fieldset>
      <div className="push-preference">
        <button
          className="button button-secondary"
          type="button"
          onClick={subscription ? disablePush : enablePush}
          disabled={busy}
        >
          {busy ? copy.updating : subscription ? copy.disable : copy.enable}
        </button>
        <small>
          {push
            ? copy.deviceCount.replace("{count}", String(subscriptionCount))
            : copy.permission}
        </small>
      </div>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
