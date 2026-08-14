import { z } from "zod";

const uuid = z.string().uuid();
export const storyLanguages = [
  "de",
  "en",
  "fr",
  "es",
  "it",
  "pt",
  "wo",
  "sw",
] as const;

export const storyActionSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("create_request"),
      child_id: uuid,
      question: z.string().trim().min(10).max(2000),
      requested_translation_language: z
        .enum(storyLanguages)
        .nullable()
        .optional(),
      request_adaptation: z.boolean().default(true),
    })
    .strict(),
  z.object({ action: z.literal("revoke_request"), request_id: uuid }).strict(),
  z
    .object({
      action: z.literal("review"),
      story_id: uuid,
      approval: z.enum(["approved", "rejected"]),
      adapted_story: z.string().trim().max(10000).nullable().optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal("edit"),
      story_id: uuid,
      transcript_original: z.string().trim().min(1).max(20000),
      transcript_translation: z.string().trim().max(20000).nullable(),
      adapted_story: z.string().trim().max(20000).nullable(),
    })
    .strict(),
  z.object({ action: z.literal("retry"), story_id: uuid }).strict(),
  z
    .object({
      action: z.literal("add_to_roots"),
      story_id: uuid,
      visibility: z.enum(["private", "family", "village"]).default("private"),
    })
    .strict(),
]);

export const storyRequestSchema = z
  .object({
    request_id: uuid,
    child_id: uuid,
    child_nickname: z.string().min(1).max(40),
    question: z.string().min(10).max(2000),
    expires_at: z.string().datetime({ offset: true }),
    status: z.enum(["active", "submitted", "revoked", "expired"]),
    created_at: z.string().datetime({ offset: true }),
  })
  .strict();

export const familyStorySchema = z
  .object({
    story_id: uuid,
    child_id: uuid,
    child_nickname: z.string().min(1).max(40),
    title: z.string().min(2).max(160),
    original_language: z.string().max(16).nullable(),
    transcript_original: z.string().nullable(),
    transcript_translation: z.string().nullable(),
    adapted_story: z.string().nullable(),
    ai_status: z.enum([
      "queued",
      "transcribing",
      "translating",
      "adapting",
      "ready",
      "failed",
    ]),
    approval_status: z.enum(["pending_review", "approved", "rejected"]),
    audio_available: z.boolean(),
    roots_entry_id: uuid.nullable(),
    requested_translation_language: z.enum(storyLanguages).nullable(),
    request_adaptation: z.boolean(),
    failure_code: z.string().max(80).nullable(),
    retry_available: z.boolean(),
    created_at: z.string().datetime({ offset: true }),
    updated_at: z.string().datetime({ offset: true }),
  })
  .strict();

export const storyRecordSchema = z
  .object({
    request_id: uuid,
    question: z.string().min(10).max(2000),
    expires_at: z.string().datetime({ offset: true }),
    can_record: z.literal(true),
  })
  .strict();

export type StoryRequest = z.infer<typeof storyRequestSchema>;
export type FamilyStory = z.infer<typeof familyStorySchema>;
export type StoryRecord = z.infer<typeof storyRecordSchema>;
export const parseStoryRequests = (value: unknown) =>
  storyRequestSchema.array().safeParse(value);
export const parseFamilyStories = (value: unknown) =>
  familyStorySchema.array().safeParse(value);
export const parseStoryRecord = (value: unknown) =>
  storyRecordSchema.array().length(1).safeParse(value);
