import { describe, expect, it } from "vitest";

import {
  parseFamilyStories,
  parseStoryRecord,
  parseStoryRequests,
} from "@/features/stories/results";
import { storyActionSchema } from "@/lib/validation/stories";

const childId = "a0000000-0000-4000-8000-000000000001";
const storyId = "a1000000-0000-4000-8000-000000000001";

describe("Roots Stories contracts", () => {
  it("accepts privacy-safe parent projections and rejects secret fields", () => {
    expect(
      parseStoryRequests([
        {
          request_id: storyId,
          child_id: childId,
          child_nickname: "Little Root",
          question: "What should our family remember about home?",
          expires_at: "2026-08-18T08:00:00+00:00",
          status: "active",
          created_at: "2026-08-11T08:00:00+00:00",
        },
      ]).success,
    ).toBe(true);
    expect(
      parseStoryRequests([{ request_id: storyId, access_token: "secret" }])
        .success,
    ).toBe(false);
    expect(
      parseFamilyStories([
        {
          story_id: storyId,
          child_id: childId,
          child_nickname: "Little Root",
          title: "A story from home",
          original_language: "fr",
          transcript_original: "A private transcript.",
          transcript_translation: null,
          adapted_story: null,
          ai_status: "ready",
          approval_status: "pending_review",
          audio_available: true,
          roots_entry_id: null,
          created_at: "2026-08-11T08:00:00+00:00",
          updated_at: "2026-08-11T08:00:00+00:00",
        },
      ]).success,
    ).toBe(true);
    expect(
      parseFamilyStories([{ story_id: storyId, audio_path: "private" }])
        .success,
    ).toBe(false);
  });

  it("keeps anonymous recording responses limited to the prompt", () => {
    expect(
      parseStoryRecord([
        {
          request_id: storyId,
          question: "What should our family remember about home?",
          expires_at: "2026-08-18T08:00:00+00:00",
          can_record: true,
        },
      ]).success,
    ).toBe(true);
    expect(
      parseStoryRecord([
        {
          request_id: storyId,
          question: "What should our family remember about home?",
          expires_at: "2026-08-18T08:00:00+00:00",
          can_record: true,
          family_id: "private",
        },
      ]).success,
    ).toBe(false);
  });

  it("requires explicit, bounded story actions", () => {
    expect(
      storyActionSchema.safeParse({
        action: "create_request",
        child_id: childId,
        question: "What should our family remember about home?",
        requested_translation_language: "fr",
        request_adaptation: true,
      }).success,
    ).toBe(true);
    expect(
      storyActionSchema.safeParse({
        action: "create_request",
        child_id: childId,
        question: "What should our family remember about home?",
        access_token: "secret",
      }).success,
    ).toBe(false);
    expect(
      storyActionSchema.safeParse({
        action: "review",
        story_id: storyId,
        approval: "approved",
      }).success,
    ).toBe(true);
  });
});
