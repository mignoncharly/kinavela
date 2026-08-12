import { describe, expect, it } from "vitest";

import { parseNotificationFeed } from "@/features/notifications/results";
import {
  notificationPreferencesActionSchema,
  pushSubscriptionSchema,
} from "@/lib/validation/notifications";

describe("Notification contracts", () => {
  it("accepts typed, privacy-safe feed entries", () => {
    expect(
      parseNotificationFeed([
        {
          notification_id: "a0000000-0000-4000-8000-000000000001",
          notification_kind: "story_ready",
          entity_type: "family_story",
          entity_id: "a1000000-0000-4000-8000-000000000001",
          payload: { child_id: "a2000000-0000-4000-8000-000000000001" },
          read_at: null,
          created_at: "2026-08-11T08:00:00+00:00",
        },
      ]).success,
    ).toBe(true);
    expect(
      parseNotificationFeed([
        {
          notification_id: "a0000000-0000-4000-8000-000000000001",
          notification_kind: "story_ready",
          entity_type: "family_story",
          entity_id: "a1000000-0000-4000-8000-000000000001",
          payload: { email: "private" },
          email: "secret",
          read_at: null,
          created_at: "2026-08-11T08:00:00+00:00",
        },
      ]).success,
    ).toBe(false);
  });

  it("requires explicit email and push actions", () => {
    expect(
      notificationPreferencesActionSchema.safeParse({
        email_enabled: true,
        push_enabled: false,
      }).success,
    ).toBe(true);
    expect(
      pushSubscriptionSchema.safeParse({
        action: "register",
        endpoint: "https://push.example.test/subscription/12345678901234567890",
        p256dh: "p".repeat(24),
        auth: "a".repeat(12),
      }).success,
    ).toBe(true);
    expect(
      pushSubscriptionSchema.safeParse({
        action: "register",
        endpoint: "https://push.example.test/subscription/12345678901234567890",
      }).success,
    ).toBe(false);
  });
});
