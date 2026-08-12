import { describe, expect, it } from "vitest";

import {
  parseConversationResults,
  parseMessageResults,
} from "@/features/messaging/results";
import {
  conversationCreateSchema,
  conversationMuteSchema,
  messageSendSchema,
  reportSchema,
} from "@/lib/validation/messaging";

const conversationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const familyId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const profileId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const messageId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

describe("family messaging contracts", () => {
  it("validates conversation, message, mute and report actions", () => {
    expect(
      conversationCreateSchema.safeParse({ family_id: familyId }).success,
    ).toBe(true);
    expect(
      messageSendSchema.safeParse({
        conversation_id: conversationId,
        body: "  Hello family  ",
      }).data?.body,
    ).toBe("Hello family");
    expect(
      conversationMuteSchema.safeParse({
        conversation_id: conversationId,
        muted: true,
      }).success,
    ).toBe(true);
    expect(
      reportSchema.safeParse({
        target_type: "message",
        target_id: messageId,
        reason: "harassment",
      }).success,
    ).toBe(true);
  });

  it("rejects empty, oversized and ambiguous external input", () => {
    expect(
      messageSendSchema.safeParse({
        conversation_id: conversationId,
        body: "   ",
      }).success,
    ).toBe(false);
    expect(
      messageSendSchema.safeParse({
        conversation_id: conversationId,
        body: "x".repeat(2001),
      }).success,
    ).toBe(false);
    expect(
      reportSchema.safeParse({
        target_type: "profile",
        target_id: profileId,
        reason: "dislike",
      }).success,
    ).toBe(false);
  });

  it("accepts only the explicit inbox projection", () => {
    const conversation = {
      conversation_id: conversationId,
      other_family_id: familyId,
      other_family_name: "Nkom Family",
      last_message_preview: "Hello family",
      last_message_at: "2026-08-09T20:00:00+00:00",
      unread_count: 2,
      muted: false,
    };
    expect(parseConversationResults([conversation]).success).toBe(true);
    expect(
      parseConversationResults([{ ...conversation, exact_location: "private" }])
        .success,
    ).toBe(false);
  });

  it("accepts plain-text participant messages and rejects extra fields", () => {
    const message = {
      message_id: messageId,
      conversation_id: conversationId,
      sender_profile_id: profileId,
      sender_family_id: familyId,
      sender_display_name: "Mireille",
      body: "Hello family",
      reply_to: null,
      is_own_family: false,
      created_at: "2026-08-09T20:00:00+00:00",
    };
    expect(parseMessageResults([message]).success).toBe(true);
    expect(
      parseMessageResults([{ ...message, sender_email: "private" }]).success,
    ).toBe(false);
  });
});
