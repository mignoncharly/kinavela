import { beforeEach, describe, expect, it, vi } from "vitest";

const { admin, rpc, sendPushToProfile } = vi.hoisted(() => {
  const rpc = vi.fn();
  return {
    admin: { rpc },
    rpc,
    sendPushToProfile: vi.fn(),
  };
});

vi.mock("server-only", () => ({}));
vi.mock("@/features/notifications/email", () => ({
  sendNotificationEmail: vi.fn(),
}));
vi.mock("@/lib/notifications/push", () => ({
  sendPushToProfile,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => admin,
}));

const { dispatchNotificationDeliveries } =
  await import("@/lib/notifications/dispatcher");

const pushDelivery = {
  delivery_id: "delivery-id",
  recipient_profile_id: "profile-id",
  channel: "push",
  notification_kind: "message_received",
  recipient_email: "private@example.test",
  locale: "fr",
  channel_enabled: true,
  payload: {
    private_message: "This content must not enter the push payload",
    exact_address: "Private street",
  },
};

describe("notification dispatcher Web Push integration", () => {
  beforeEach(() => {
    rpc.mockReset();
    sendPushToProfile.mockReset();
  });

  it("delivers generic localized push copy to the claimed profile", async () => {
    rpc.mockImplementation(async (name: string) => {
      if (name === "claim_notification_deliveries") {
        return { data: [pushDelivery], error: null };
      }
      return { data: true, error: null };
    });
    sendPushToProfile.mockResolvedValue({
      attempted: 1,
      delivered: 1,
      removed: 0,
    });

    const result = await dispatchNotificationDeliveries();

    expect(result).toEqual({
      claimed: 1,
      sent: 1,
      failed: 0,
      suppressed: 0,
    });
    expect(rpc).toHaveBeenCalledWith("dispatch_compatible_family_alerts");
    expect(sendPushToProfile).toHaveBeenCalledWith(
      "profile-id",
      expect.objectContaining({
        title: "Kinavela",
        body: "Vous avez reçu un nouveau message privé.",
        url: "/fr/app/messages",
        tag: "kinavela:message_received:delivery-id",
      }),
      { admin },
    );
    expect(JSON.stringify(sendPushToProfile.mock.calls)).not.toContain(
      "Private street",
    );
    expect(rpc).toHaveBeenCalledWith("complete_notification_delivery", {
      p_delivery_id: "delivery-id",
      p_status: "sent",
      p_error_code: null,
    });
  });

  it("suppresses an outbox item when the profile has no active device", async () => {
    rpc.mockImplementation(async (name: string) => {
      if (name === "claim_notification_deliveries") {
        return { data: [pushDelivery], error: null };
      }
      return { data: true, error: null };
    });
    sendPushToProfile.mockResolvedValue({
      attempted: 0,
      delivered: 0,
      removed: 0,
    });

    const result = await dispatchNotificationDeliveries();

    expect(result).toEqual({
      claimed: 1,
      sent: 0,
      failed: 0,
      suppressed: 1,
    });
    expect(rpc).toHaveBeenCalledWith("complete_notification_delivery", {
      p_delivery_id: "delivery-id",
      p_status: "suppressed",
      p_error_code: "push_subscription_unavailable",
    });
  });

  it("does not call the provider when the rollout flag is disabled", async () => {
    rpc.mockImplementation(async (name: string) => {
      if (name === "claim_notification_deliveries") {
        return {
          data: [{ ...pushDelivery, channel_enabled: false }],
          error: null,
        };
      }
      return { data: true, error: null };
    });

    const result = await dispatchNotificationDeliveries();

    expect(result).toEqual({
      claimed: 1,
      sent: 0,
      failed: 0,
      suppressed: 1,
    });
    expect(sendPushToProfile).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith("complete_notification_delivery", {
      p_delivery_id: "delivery-id",
      p_status: "suppressed",
      p_error_code: "delivery_channel_disabled",
    });
  });
});
