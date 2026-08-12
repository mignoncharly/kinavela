import { z } from "zod";

export const rootsEntryTypes = [
  "language",
  "story",
  "recipe",
  "place",
  "tradition",
  "event",
  "family_memory",
  "achievement",
  "trip",
  "photo",
  "audio",
  "video",
  "document",
] as const;
export const rootsVisibilities = ["private", "family", "village"] as const;

const uuid = z.string().uuid();

export const rootsActionSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("create_entry"),
      child_id: uuid,
      type: z.enum(rootsEntryTypes),
      title: z.string().trim().min(2).max(160),
      description: z.string().trim().max(5000).nullable().optional(),
      occurred_at: z.string().datetime({ offset: true }).nullable().optional(),
      visibility: z.enum(rootsVisibilities),
      culture_id: uuid.nullable().optional(),
      language_id: uuid.nullable().optional(),
      event_id: uuid.nullable().optional(),
      mission_id: uuid.nullable().optional(),
      village_id: uuid.nullable().optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal("mission_entry"),
      child_id: uuid,
      mission_id: uuid,
      title: z.string().trim().min(2).max(160),
      description: z.string().trim().max(5000),
      occurred_at: z.string().datetime({ offset: true }).nullable().optional(),
      visibility: z.enum(rootsVisibilities),
    })
    .strict(),
  z.object({ action: z.literal("delete_entry"), entry_id: uuid }).strict(),
  z.object({ action: z.literal("export"), child_id: uuid }).strict(),
]);

export const rootsPassportSchema = z
  .object({
    passport_id: uuid,
    child_id: uuid,
    child_nickname: z.string().min(1).max(40),
    entry_count: z.number().int().min(0),
    last_occurred_at: z.string().datetime({ offset: true }).nullable(),
  })
  .strict();

export const rootsEntrySchema = z
  .object({
    entry_id: uuid,
    passport_id: uuid,
    child_id: uuid,
    type: z.enum(rootsEntryTypes),
    title: z.string().min(2).max(160),
    description: z.string().max(5000).nullable(),
    culture_name: z.string().min(2).max(120).nullable(),
    language_name: z.string().min(2).max(120).nullable(),
    event_id: uuid.nullable(),
    mission_id: uuid.nullable(),
    village_id: uuid.nullable(),
    occurred_at: z.string().datetime({ offset: true }),
    visibility: z.enum(rootsVisibilities),
    media_kind: z.enum(["photo", "audio", "video", "document"]).nullable(),
    media_available: z.boolean(),
    created_at: z.string().datetime({ offset: true }),
  })
  .strict();

export const completedMissionSchema = z
  .object({
    mission_id: uuid,
    title: z.string().min(3).max(160),
    progress_status: z.literal("completed"),
  })
  .strict();

export type RootsPassport = z.infer<typeof rootsPassportSchema>;
export type RootsEntry = z.infer<typeof rootsEntrySchema>;
export type CompletedMission = z.infer<typeof completedMissionSchema>;

export const parseRootsPassports = (value: unknown) =>
  rootsPassportSchema.array().safeParse(value);
export const parseRootsEntries = (value: unknown) =>
  rootsEntrySchema.array().safeParse(value);
export const parseCompletedMissions = (value: unknown) =>
  completedMissionSchema.array().safeParse(value);
