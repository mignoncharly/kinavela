import "server-only";

import { getNotificationDeliveryCopy } from "@/features/notifications/email-copy";
import { sendTransactionalEmail } from "@/lib/email/transport";
import type { NotificationFeedItem } from "@/lib/validation/notifications";

export async function sendNotificationEmail(
  to: string,
  locale: string,
  kind: NotificationFeedItem["notification_kind"],
  actionUrl: string,
) {
  const message = getNotificationDeliveryCopy(locale);
  const subject = message.subjects[kind];
  const detail = message.bodies[kind];
  const escapedUrl = actionUrl.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  await sendTransactionalEmail({
    to,
    subject: `Kinavela · ${subject}`,
    text: `${message.emailIntro}\n\n${detail}\n\n${message.open}: ${actionUrl}\n\nKinavela`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px;color:#26352e"><p style="letter-spacing:.16em;font-weight:700">KINAVELA</p><p>${message.emailIntro}</p><p>${detail}</p><p><a href="${escapedUrl}" style="display:inline-block;background:#9f4334;color:#fff;padding:14px 22px;border-radius:999px;text-decoration:none;font-weight:700">${message.open}</a></p></div>`,
  });
}
