import { z } from "zod";

export const aiFeatures = [
  "story_transcription",
  "story_translation",
  "story_adaptation",
  "cultural_activity_ideas",
  "mission_draft",
  "event_description",
] as const;

export const aiFeatureSchema = z.enum(aiFeatures);
export type AiFeature = z.infer<typeof aiFeatureSchema>;

const contextSchema = z
  .record(z.string(), z.string().max(4000))
  .refine(
    (value) => JSON.stringify(value).length <= 16000,
    "AI context is too large",
  );

export const aiActionSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("create"),
      feature: aiFeatureSchema,
      subject_type: z.string().regex(/^[a-z][a-z0-9_]{1,40}$/),
      subject_id: z.string().uuid().nullable().optional(),
      locale: z.enum(["de", "en", "fr"]),
      context: contextSchema.default({}),
    })
    .strict(),
  z
    .object({
      action: z.literal("review"),
      job_id: z.string().uuid(),
      moderation_status: z.enum(["approved", "rejected"]),
    })
    .strict(),
]);

export type AiAction = z.infer<typeof aiActionSchema>;
