import { describe, expect, it } from "vitest";

import { parseNotificationFeed } from "@/features/notifications/results";
import {
  notificationPreferencesActionSchema,
  pushSubscriptionSchema,
} from "@/lib/validation/notifications";
import { notificationPath } from "@/lib/notifications/links";

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
        community_enabled: true,
        events_enabled: true,
        direct_enabled: true,
        heritage_enabled: true,
        safety_enabled: true,
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

  it("accepts an identity-free compatible-family alert", () => {
    const parsed = parseNotificationFeed([
      {
        notification_id: "a0000000-0000-4000-8000-000000000009",
        notification_kind: "compatible_family_available",
        entity_type: "discovery_alert_batch",
        entity_id: "a1000000-0000-4000-8000-000000000009",
        payload: { match_count: 2, radius_km: 40 },
        read_at: null,
        created_at: "2026-08-13T12:00:00+00:00",
      },
    ]);
    expect(parsed.success).toBe(true);
    expect(JSON.stringify(parsed.data)).not.toContain("candidate_family");
  });

  it("builds only same-origin notification destinations", () => {
    expect(
      notificationPath("en", "support_response", {
        village_id: "a1000000-0000-4000-8000-000000000009",
        url: "https://attacker.example",
      }),
    ).toBe("/en/app/villages/a1000000-0000-4000-8000-000000000009");
    expect(
      notificationPath("fr", "story_failed", {
        url: "https://attacker.example",
      }),
    ).toBe("/fr/app/stories");
  });
});

describe("legacy access notification", () => {
  it("is identity-free and opens only same-origin discovery", () => {
    const parsed = parseNotificationFeed([
      {
        notification_id: "a0000000-0000-4000-8000-000000000010",
        notification_kind: "germany_access_opened",
        entity_type: "legacy_waitlist",
        entity_id: "a1000000-0000-4000-8000-000000000010",
        payload: { country_code: "DE", access: "available" },
        read_at: null,
        created_at: "2026-08-13T12:00:00+00:00",
      },
    ]);
    expect(parsed.success).toBe(true);
    expect(JSON.stringify(parsed.data)).not.toMatch(
      /email|child|address|message|transcript/i,
    );
    expect(
      notificationPath("de", "germany_access_opened", {
        url: "https://attacker.example",
      }),
    ).toBe("/de/app/discover");
  });
});
