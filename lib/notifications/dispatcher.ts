import "server-only";

import { sendNotificationEmail } from "@/features/notifications/email";
import {
  sendPushToProfile,
  type PushNotificationPayload,
} from "@/lib/notifications/push";
import { createAdminClient } from "@/lib/supabase/admin";
import type { NotificationFeedItem } from "@/lib/validation/notifications";

type Delivery = {
  delivery_id: string;
  recipient_profile_id: string;
  channel: "in_app" | "email" | "push";
  notification_kind: NotificationFeedItem["notification_kind"];
  recipient_email: string | null;
  locale: string;
  channel_enabled: boolean;
  payload: Record<string, unknown>;
};

const pushBodies = {
  de: {
    connection_request: "Eine Familie möchte sich mit Ihnen verbinden.",
    connection_accepted: "Ihre Familienverbindung wurde bestätigt.",
    message_received: "Sie haben eine neue private Nachricht.",
    event_reminder: "Eine Familienaktivität beginnt bald.",
    village_activity: "In Ihrem Village gibt es eine neue Aktivität.",
    story_ready: "Eine Familiengeschichte ist zur Prüfung bereit.",
  },
  fr: {
    connection_request: "Une famille souhaite entrer en contact avec vous.",
    connection_accepted: "Votre mise en relation familiale a été acceptée.",
    message_received: "Vous avez reçu un nouveau message privé.",
    event_reminder: "Une activité familiale commence bientôt.",
    village_activity: "Il y a une nouvelle activité dans votre Village.",
    story_ready: "Une histoire familiale est prête à être vérifiée.",
  },
  en: {
    connection_request: "A family would like to connect with you.",
    connection_accepted: "Your family connection was accepted.",
    message_received: "You have a new private message.",
    event_reminder: "A family activity is starting soon.",
    village_activity: "There is new activity in your Village.",
    story_ready: "A family story is ready for review.",
  },
} as const;

function pushPayload(delivery: Delivery): PushNotificationPayload {
  const locale =
    delivery.locale === "de" || delivery.locale === "fr"
      ? delivery.locale
      : "en";
  return {
    title: "Kinavela",
    body: pushBodies[locale][delivery.notification_kind],
    url: `/${locale}/app/notifications`,
    tag: `kinavela:${delivery.notification_kind}`,
    data: { notificationKind: delivery.notification_kind },
  };
}

export async function dispatchNotificationDeliveries() {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_notification_deliveries");
  if (error) throw error;

  let sent = 0;
  let failed = 0;
  let suppressed = 0;

  for (const delivery of (data ?? []) as Delivery[]) {
    try {
      if (!delivery.channel_enabled) {
        await complete(
          admin,
          delivery.delivery_id,
          "suppressed",
          "delivery_channel_disabled",
        );
        suppressed += 1;
        continue;
      }

      if (delivery.channel === "in_app") {
        await complete(admin, delivery.delivery_id, "sent");
        sent += 1;
        continue;
      }

      if (delivery.channel === "email") {
        if (!delivery.recipient_email) {
          await complete(
            admin,
            delivery.delivery_id,
            "suppressed",
            "recipient_email_missing",
          );
          suppressed += 1;
          continue;
        }
        await sendNotificationEmail(
          delivery.recipient_email,
          delivery.locale,
          delivery.notification_kind,
        );
        await complete(admin, delivery.delivery_id, "sent");
        sent += 1;
        continue;
      }

      const result = await sendPushToProfile(
        delivery.recipient_profile_id,
        pushPayload(delivery),
        { admin },
      );
      if (result.delivered > 0) {
        await complete(admin, delivery.delivery_id, "sent");
        sent += 1;
      } else if (
        result.attempted === 0 ||
        result.removed === result.attempted
      ) {
        await complete(
          admin,
          delivery.delivery_id,
          "suppressed",
          "push_subscription_unavailable",
        );
        suppressed += 1;
      } else {
        const pushError = new Error("Web Push delivery failed");
        Object.assign(pushError, { code: "push_delivery_failed" });
        throw pushError;
      }
    } catch (caught) {
      const errorCode =
        caught instanceof Error &&
        "code" in caught &&
        typeof caught.code === "string"
          ? caught.code
          : "notification_delivery_failed";
      await complete(admin, delivery.delivery_id, "failed", errorCode);
      failed += 1;
    }
  }

  return { claimed: (data ?? []).length, sent, failed, suppressed };
}

async function complete(
  admin: ReturnType<typeof createAdminClient>,
  deliveryId: string,
  status: "sent" | "failed" | "suppressed",
  errorCode?: string,
) {
  const { error } = await admin.rpc("complete_notification_delivery", {
    p_delivery_id: deliveryId,
    p_status: status,
    p_error_code: errorCode ?? null,
  });
  if (error) throw error;
}
