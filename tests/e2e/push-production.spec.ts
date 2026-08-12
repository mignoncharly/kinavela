import { expect, test } from "@playwright/test";

test("push persistence rejects unauthenticated same-origin requests", async ({
  request,
}) => {
  const appOrigin = process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3020";
  const response = await request.post("/api/notifications/push", {
    headers: { origin: new URL(appOrigin).origin },
    data: {
      action: "register",
      endpoint: "https://push.example.test/subscription/12345678901234567890",
      p256dh: "p".repeat(24),
      auth: "a".repeat(12),
    },
  });

  expect(response.status()).toBe(401);
  expect(await response.json()).toEqual({ ok: false });
});

test("production serves the push worker without server credentials", async ({
  request,
}) => {
  const response = await request.get("/sw.js");
  expect(response.ok()).toBeTruthy();
  const worker = await response.text();
  expect(worker).toContain("notificationclick");
  expect(worker).toContain("pushsubscriptionchange");
  expect(worker).toContain("kinavela-shell-v2");
  expect(worker).not.toContain("WEB_PUSH_VAPID_PRIVATE_KEY");
  expect(worker).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
});
