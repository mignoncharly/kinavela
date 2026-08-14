"use client";

import { Bell, Check } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { NotificationFeedItem } from "@/lib/validation/notifications";
import type { Locale } from "@/lib/i18n/config";
import { getAppDictionary } from "@/lib/i18n/app-copy";
import { notificationPath } from "@/lib/notifications/links";
import { formatDateTime } from "@/lib/i18n/format";

export function NotificationCenter({
  items,
  locale,
}: {
  items: NotificationFeedItem[];
  locale: Locale;
}) {
  const copy = getAppDictionary(locale).notifications;
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
        <h2>{copy.title}</h2>
      </div>
      {items.length === 0 ? (
        <p className="notification-muted">{copy.empty}</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li
              className={item.read_at ? "" : "unread"}
              key={item.notification_id}
            >
              <div>
                <strong>{copy.labels[item.notification_kind]}</strong>
                <small>{formatDateTime(locale, item.created_at)}</small>
                <Link
                  className="notification-action-link"
                  href={notificationPath(
                    locale,
                    item.notification_kind,
                    item.payload,
                  )}
                >
                  {copy.open}
                </Link>
              </div>
              {!item.read_at && (
                <button
                  className="button button-secondary"
                  disabled={busy !== null}
                  type="button"
                  onClick={() => markRead(item.notification_id)}
                >
                  <Check size={15} /> {copy.markRead}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
