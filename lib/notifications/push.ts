import "server-only";

export class PushProviderUnavailableError extends Error {
  readonly code = "push_provider_unconfigured";
}

export async function sendWebPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: { kind: string },
) {
  void subscription;
  void payload;
  throw new PushProviderUnavailableError(
    "Web push delivery adapter is not configured",
  );
}
