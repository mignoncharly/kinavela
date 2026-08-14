import "server-only";

import { sendTransactionalEmail } from "@/lib/email/transport";
import {
  authEmailChrome,
  authEmailCopy,
  type AuthEmailKind,
} from "@/features/auth/email-copy";
import type { Locale } from "@/lib/i18n/config";

export async function sendAuthEmail(
  to: string,
  locale: Locale,
  kind: AuthEmailKind,
  actionUrl: string,
) {
  const message = authEmailCopy[locale][kind];
  const chrome = authEmailChrome[locale];
  const escapedUrl = actionUrl.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  await sendTransactionalEmail({
    to,
    subject: message.subject,
    text: `${message.title}\n\n${message.action}: ${actionUrl}\n\n${chrome.fallback}\n${actionUrl}\n\n${message.note}\n\n--\nKinavela\n${chrome.footer}`,
    // Send a complete HTML document rather than a bare fragment: filters score
    // fragments worse, and Outlook renders them inconsistently.
    html: `<!DOCTYPE html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${message.title}</title></head><body style="margin:0;padding:0;background:#faf8f5"><div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px;color:#26352e"><p style="letter-spacing:.16em;font-weight:700">KINAVELA</p><h1 style="font-family:Georgia,serif;font-weight:400">${message.title}</h1><p><a href="${escapedUrl}" style="display:inline-block;background:#9f4334;color:#fff;padding:14px 22px;border-radius:999px;text-decoration:none;font-weight:700">${message.action}</a></p><p style="color:#6d746e;font-size:14px">${chrome.fallback}<br><a href="${escapedUrl}" style="color:#9f4334;word-break:break-all">${escapedUrl}</a></p><p style="color:#6d746e;font-size:14px">${message.note}</p><hr style="border:none;border-top:1px solid #e3ded6;margin:24px 0"><p style="color:#8a908b;font-size:12px">Kinavela &middot; ${chrome.footer}</p></div></body></html>`,
  });
}
