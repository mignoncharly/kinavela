import "server-only";

import webpush from "web-push";

import { serverEnv } from "@/lib/env.server";
import { createAdminClient } from "@/lib/supabase/admin";

export type PushNotificationPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  data?: Record<string, unknown>;
};

export class PushProviderUnavailableError extends Error {
  readonly code = "push_provider_unconfigured";
}

type StoredSubscription = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  failure_count: number;
};

function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY;
  const privateKey = serverEnv.WEB_PUSH_VAPID_PRIVATE_KEY;
  const subject = serverEnv.WEB_PUSH_VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    throw new PushProviderUnavailableError(
      "Web Push delivery is not configured",
    );
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
}

export function isExpiredSubscription(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    (error.statusCode === 404 || error.statusCode === 410)
  );
}

async function recordFailure(
  admin: ReturnType<typeof createAdminClient>,
  subscription: StoredSubscription,
) {
  await admin
    .from("notification_push_subscriptions")
    .update({
      last_failure_at: new Date().toISOString(),
      failure_count: subscription.failure_count + 1,
    })
    .eq("id", subscription.id);
}

type PushDeliveryDependencies = {
  admin?: ReturnType<typeof createAdminClient>;
  sendNotification?: typeof webpush.sendNotification;
};

export async function sendPushToProfile(
  profileId: string,
  payload: PushNotificationPayload,
  dependencies: PushDeliveryDependencies = {},
) {
  configureWebPush();
  const admin = dependencies.admin ?? createAdminClient();
  const sendNotification =
    dependencies.sendNotification ?? webpush.sendNotification.bind(webpush);
  const { data, error } = await admin
    .from("notification_push_subscriptions")
    .select("id, endpoint, p256dh, auth, failure_count")
    .eq("profile_id", profileId);

  if (error) throw new Error("Unable to load notification subscriptions");

  const subscriptions = (data ?? []) as StoredSubscription[];
  const results = await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          JSON.stringify(payload),
          { TTL: 60 * 60 },
        );

        await admin
          .from("notification_push_subscriptions")
          .update({
            last_success_at: new Date().toISOString(),
            last_failure_at: null,
            failure_count: 0,
            last_used_at: new Date().toISOString(),
          })
          .eq("id", subscription.id);

        return { delivered: true, removed: false };
      } catch (error) {
        if (isExpiredSubscription(error)) {
          await admin
            .from("notification_push_subscriptions")
            .delete()
            .eq("id", subscription.id);
          return { delivered: false, removed: true };
        }

        await recordFailure(admin, subscription);
        return { delivered: false, removed: false };
      }
    }),
  );

  const summary = {
    attempted: results.length,
    delivered: results.filter((result) => result.delivered).length,
    removed: results.filter((result) => result.removed).length,
  };

  if (summary.attempted > 0 && summary.removed === summary.attempted) {
    await admin
      .from("notification_preferences")
      .update({ push_enabled: false, updated_at: new Date().toISOString() })
      .eq("profile_id", profileId);
  }

  return summary;
}
