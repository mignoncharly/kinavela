"use client";

import { useState } from "react";

import type { NotificationPreferences } from "@/lib/validation/notifications";
import { publicEnv } from "@/lib/env.public";

export function NotificationPreferencesForm({
  initial,
}: {
  initial: NotificationPreferences;
}) {
  const [email, setEmail] = useState(initial.email_enabled);
  const [push, setPush] = useState(initial.push_enabled);
  const [message, setMessage] = useState("");
  async function save(nextEmail = email, nextPush = push) {
    const response = await fetch("/api/notifications/preferences", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email_enabled: nextEmail,
        push_enabled: nextPush,
      }),
    });
    setMessage(
      response.ok
        ? "Notification preferences saved."
        : "Could not save preferences.",
    );
  }
  async function enablePush() {
    if (
      !publicEnv.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY ||
      !("Notification" in window) ||
      !("serviceWorker" in navigator)
    ) {
      setMessage("Web push is not configured on this device yet.");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setMessage("Push permission was not granted.");
      return;
    }
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: publicEnv.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY,
    });
    const json = subscription.toJSON();
    const response = await fetch("/api/notifications/push", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "register",
        endpoint: json.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
      }),
    });
    if (response.ok) {
      setPush(true);
      setMessage("Push notifications enabled.");
    } else setMessage("Could not enable push notifications.");
  }
  return (
    <section className="notification-preferences">
      <h2>Notifications</h2>
      <label>
        <input
          type="checkbox"
          checked={email}
          onChange={(event) => {
            setEmail(event.target.checked);
            void save(event.target.checked, push);
          }}
        />{" "}
        Receive typed email updates
      </label>
      <div className="push-preference">
        <button
          className="button button-secondary"
          type="button"
          onClick={enablePush}
        >
          {push ? "Push notifications enabled" : "Enable web push"}
        </button>
        <small>
          Push requires explicit browser permission and a configured
          subscription key.
        </small>
      </div>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
