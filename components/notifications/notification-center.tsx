"use client";

import { Bell, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { NotificationFeedItem } from "@/lib/validation/notifications";

const labels: Record<NotificationFeedItem["notification_kind"], string> = {
  connection_request: "New connection request",
  connection_accepted: "Connection accepted",
  message_received: "New message",
  event_reminder: "Event reminder",
  village_activity: "Village activity",
  story_ready: "A family story is ready to review",
};

export function NotificationCenter({
  items,
}: {
  items: NotificationFeedItem[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  async function markRead(notificationId: string) {
    setBusy(notificationId);
    const response = await fetch("/api/notifications/feed", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ notification_id: notificationId }),
    });
    setBusy(null);
    if (response.ok) router.refresh();
  }
  return (
    <section className="notification-center">
      <div className="notification-center-heading">
        <Bell size={20} />
        <h2>Notifications</h2>
      </div>
      {items.length === 0 ? (
        <p className="notification-muted">You are all caught up.</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li
              className={item.read_at ? "" : "unread"}
              key={item.notification_id}
            >
              <div>
                <strong>{labels[item.notification_kind]}</strong>
                <small>{new Date(item.created_at).toLocaleString()}</small>
              </div>
              {!item.read_at && (
                <button
                  className="button button-secondary"
                  disabled={busy !== null}
                  type="button"
                  onClick={() => markRead(item.notification_id)}
                >
                  <Check size={15} /> Mark read
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
