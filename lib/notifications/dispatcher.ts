import "server-only";

import { sendNotificationEmail } from "@/features/notifications/email";
import { sendWebPushNotification } from "@/lib/notifications/push";
import { createAdminClient } from "@/lib/supabase/admin";
import type { NotificationFeedItem } from "@/lib/validation/notifications";

type Delivery = {
  delivery_id: string;
  channel: "in_app" | "email" | "push";
  notification_kind: NotificationFeedItem["notification_kind"];
  recipient_email: string | null;
  locale: string;
  payload: Record<string, unknown>;
};

export async function dispatchNotificationDeliveries() {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_notification_deliveries");
  if (error) throw error;
  let sent = 0;
  let failed = 0;
  for (const delivery of (data ?? []) as Delivery[]) {
    try {
      if (delivery.channel === "in_app") {
        await complete(admin, delivery.delivery_id, "sent");
      } else if (delivery.channel === "email" && delivery.recipient_email) {
        await sendNotificationEmail(
          delivery.recipient_email,
          delivery.locale,
          delivery.notification_kind,
        );
        await complete(admin, delivery.delivery_id, "sent");
      } else {
        await sendWebPushNotification(
          { endpoint: "", p256dh: "", auth: "" },
          { kind: delivery.notification_kind },
        );
      }
      sent += 1;
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
  return { claimed: (data ?? []).length, sent, failed };
}

async function complete(
  admin: ReturnType<typeof createAdminClient>,
  deliveryId: string,
  status: "sent" | "failed",
  errorCode?: string,
) {
  const { error } = await admin.rpc("complete_notification_delivery", {
    p_delivery_id: deliveryId,
    p_status: status,
    p_error_code: errorCode ?? null,
  });
  if (error) throw error;
}
