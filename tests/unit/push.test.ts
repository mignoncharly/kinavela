import { describe, expect, it, vi } from "vitest";

const { serverEnv, setVapidDetails } = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY = "B".repeat(87);
  return {
    serverEnv: {
      WEB_PUSH_VAPID_PRIVATE_KEY: "server-only-private-key-value-1234567890",
      WEB_PUSH_VAPID_SUBJECT: "mailto:push@example.test",
    },
    setVapidDetails: vi.fn(),
  };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/env.server", () => ({ serverEnv }));
vi.mock("web-push", () => ({
  default: { setVapidDetails, sendNotification: vi.fn() },
}));

const { isExpiredSubscription, sendPushToProfile } =
  await import("@/lib/notifications/push");

function makeAdmin(rows: unknown[]) {
  const subscriptionUpdateEq = vi.fn().mockResolvedValue({ error: null });
  const preferenceUpdateEq = vi.fn().mockResolvedValue({ error: null });
  const deleteEq = vi.fn().mockResolvedValue({ error: null });
  const selectEq = vi.fn().mockResolvedValue({ data: rows, error: null });
  const from = vi.fn((table: string) => {
    if (table === "notification_push_subscriptions") {
      return {
        select: vi.fn(() => ({ eq: selectEq })),
        update: vi.fn(() => ({ eq: subscriptionUpdateEq })),
        delete: vi.fn(() => ({ eq: deleteEq })),
      };
    }
    if (table === "notification_preferences") {
      return {
        update: vi.fn(() => ({ eq: preferenceUpdateEq })),
      };
    }
    throw new Error("unexpected table");
  });
  return {
    admin: { from } as never,
    from,
    subscriptionUpdateEq,
    preferenceUpdateEq,
    deleteEq,
  };
}

describe("Web Push delivery", () => {
  it("recognizes provider responses for expired subscriptions", () => {
    expect(isExpiredSubscription({ statusCode: 404 })).toBe(true);
    expect(isExpiredSubscription({ statusCode: 410 })).toBe(true);
    expect(isExpiredSubscription({ statusCode: 500 })).toBe(false);
    expect(isExpiredSubscription("410")).toBe(false);
  });

  it("removes expired subscriptions and disables push when none remain", async () => {
    const endpoint = "https://push.example.test/subscription-secret";
    const { admin, deleteEq, preferenceUpdateEq } = makeAdmin([
      {
        id: "subscription-id",
        endpoint,
        p256dh: "p256dh-value-123456",
        auth: "auth-value-123456",
        failure_count: 0,
      },
    ]);
    const sendNotification = vi
      .fn()
      .mockRejectedValue({ statusCode: 410, body: "expired" });

    const result = await sendPushToProfile(
      "profile-id",
      { title: "Test", body: "Hello" },
      { admin, sendNotification },
    );

    expect(result).toEqual({ attempted: 1, delivered: 0, removed: 1 });
    expect(deleteEq).toHaveBeenCalledWith("id", "subscription-id");
    expect(preferenceUpdateEq).toHaveBeenCalledWith("profile_id", "profile-id");
    expect(JSON.stringify(result)).not.toContain(endpoint);
  });

  it("records transient failures and retains the subscription", async () => {
    const { admin, deleteEq, subscriptionUpdateEq, preferenceUpdateEq } =
      makeAdmin([
        {
          id: "subscription-id",
          endpoint: "https://push.example.test/subscription",
          p256dh: "p256dh-value-123456",
          auth: "auth-value-123456",
          failure_count: 2,
        },
      ]);
    const sendNotification = vi.fn().mockRejectedValue({ statusCode: 503 });

    const result = await sendPushToProfile(
      "profile-id",
      { title: "Test", body: "Hello" },
      { admin, sendNotification },
    );

    expect(result).toEqual({ attempted: 1, delivered: 0, removed: 0 });
    expect(subscriptionUpdateEq).toHaveBeenCalledWith("id", "subscription-id");
    expect(deleteEq).not.toHaveBeenCalled();
    expect(preferenceUpdateEq).not.toHaveBeenCalled();
  });

  it("records successful delivery health without exposing the endpoint", async () => {
    const endpoint = "https://push.example.test/subscription-private";
    const { admin, subscriptionUpdateEq } = makeAdmin([
      {
        id: "subscription-id",
        endpoint,
        p256dh: "p256dh-value-123456",
        auth: "auth-value-123456",
        failure_count: 1,
      },
    ]);
    const sendNotification = vi.fn().mockResolvedValue({ statusCode: 201 });

    const result = await sendPushToProfile(
      "profile-id",
      {
        title: "Kinavela",
        body: "A family would like to connect.",
        url: "/en/app/notifications",
      },
      { admin, sendNotification },
    );

    expect(result).toEqual({ attempted: 1, delivered: 1, removed: 0 });
    expect(subscriptionUpdateEq).toHaveBeenCalledWith("id", "subscription-id");
    expect(JSON.stringify(result)).not.toContain(endpoint);
  });
});
