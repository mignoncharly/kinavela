import "server-only";

import type { Locale } from "@/lib/i18n/config";
import { sendTransactionalEmail } from "@/lib/email/transport";
import type { NotificationFeedItem } from "@/lib/validation/notifications";

const copy = {
  de: {
    subject: "Neue Kinavela-Aktivität",
    body: "In deinem privaten Kinavela-Bereich gibt es eine neue Benachrichtigung.",
  },
  fr: {
    subject: "Nouvelle activité Kinavela",
    body: "Une nouvelle notification vous attend dans votre espace Kinavela privé.",
  },
  en: {
    subject: "New Kinavela activity",
    body: "A new notification is waiting in your private Kinavela space.",
  },
} satisfies Record<Locale, { subject: string; body: string }>;

export async function sendNotificationEmail(
  to: string,
  locale: string,
  kind: NotificationFeedItem["notification_kind"],
) {
  const message = copy[locale as Locale] ?? copy.en;
  const detail =
    kind === "story_ready"
      ? "A family story is ready for review."
      : kind === "event_reminder"
        ? "You have an upcoming event reminder."
        : "Your family space has an update.";
  await sendTransactionalEmail({
    to,
    subject: message.subject,
    text: `${message.body}\n\n${detail}\n\nKinavela`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px;color:#26352e"><p style="letter-spacing:.16em;font-weight:700">KINAVELA</p><p>${message.body}</p><p>${detail}</p></div>`,
  });
}
