import type { Locale } from "@/lib/i18n/config";
import type { NotificationFeedItem } from "@/lib/validation/notifications";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function safeVillagePath(locale: Locale, payload: Record<string, unknown>) {
  const villageId = payload.village_id;
  return typeof villageId === "string" && uuidPattern.test(villageId)
    ? `/${locale}/app/villages/${villageId}`
    : `/${locale}/app/villages`;
}

export function notificationPath(
  locale: Locale,
  kind: NotificationFeedItem["notification_kind"],
  payload: Record<string, unknown> = {},
) {
  if (kind === "compatible_family_available") return `/${locale}/app/discover`;
  if (kind === "germany_access_opened") return `/${locale}/app/discover`;
  if (kind === "passport_export_ready") return `/${locale}/app/roots`;
  if (kind === "story_ready" || kind === "story_failed")
    return `/${locale}/app/stories`;
  if (
    kind === "connection_request" ||
    kind === "connection_accepted" ||
    kind === "playdate_proposal"
  )
    return `/${locale}/app/connections`;
  if (kind === "message_received") return `/${locale}/app/messages`;
  if (
    kind === "village_activity" ||
    kind === "village_invitation" ||
    kind === "village_join_request" ||
    kind === "village_join_decision" ||
    kind === "support_response" ||
    kind === "event_invitation" ||
    kind === "event_changed" ||
    kind === "event_rsvp_update" ||
    kind === "event_reminder"
  )
    return safeVillagePath(locale, payload);
  return `/${locale}/app/notifications`;
}
