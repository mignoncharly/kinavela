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
  z.object({ action: z.literal("retry_export"), export_id: uuid }).strict(),
  z
    .object({
      action: z.literal("update_entry"),
      entry_id: uuid,
      type: z.enum(rootsEntryTypes),
      title: z.string().trim().min(2).max(160),
      description: z.string().trim().max(5000).nullable().optional(),
      occurred_at: z.string().datetime({ offset: true }),
      visibility: z.enum(rootsVisibilities),
      culture_id: uuid.nullable(),
      language_id: uuid.nullable(),
      event_id: uuid.nullable(),
      mission_id: uuid.nullable(),
      village_id: uuid.nullable(),
    })
    .strict(),
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
    culture_id: uuid.nullable(),
    culture_name: z.string().min(2).max(120).nullable(),
    language_id: uuid.nullable(),
    language_name: z.string().min(2).max(120).nullable(),
    event_id: uuid.nullable(),
    event_title: z.string().min(2).max(160).nullable(),
    mission_id: uuid.nullable(),
    mission_title: z.string().min(3).max(160).nullable(),
    village_id: uuid.nullable(),
    village_name: z.string().min(2).max(120).nullable(),
    occurred_at: z.string().datetime({ offset: true }),
    visibility: z.enum(rootsVisibilities),
    media_kind: z.enum(["photo", "audio", "video", "document"]).nullable(),
    media_mime_type: z.string().min(3).max(120).nullable(),
    media_size_bytes: z.number().int().min(1).max(25_000_000).nullable(),
    media_available: z.boolean(),
    created_at: z.string().datetime({ offset: true }),
    updated_at: z.string().datetime({ offset: true }),
  })
  .strict();

const namedOptionSchema = z
  .object({ id: uuid, name: z.string().min(1).max(160) })
  .strict();
const eventOptionSchema = namedOptionSchema
  .extend({ village_id: uuid })
  .strict();
export const rootsOptionsSchema = z
  .object({
    cultures: namedOptionSchema.array(),
    languages: namedOptionSchema.array(),
    missions: namedOptionSchema.array(),
    villages: namedOptionSchema.array(),
    events: eventOptionSchema.array(),
  })
  .strict();

export const rootsExportSchema = z
  .object({
    export_id: uuid,
    status: z.enum(["queued", "processing", "ready", "failed", "expired"]),
    requested_at: z.string().datetime({ offset: true }),
    completed_at: z.string().datetime({ offset: true }).nullable(),
    expires_at: z.string().datetime({ offset: true }).nullable(),
    attempts: z.number().int().min(0).max(10),
    error_code: z.string().min(3).max(80).nullable(),
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
export type RootsOptions = z.infer<typeof rootsOptionsSchema>;
export type RootsExport = z.infer<typeof rootsExportSchema>;

export const parseRootsPassports = (value: unknown) =>
  rootsPassportSchema.array().safeParse(value);
export const parseRootsEntries = (value: unknown) =>
  rootsEntrySchema.array().safeParse(value);
export const parseCompletedMissions = (value: unknown) =>
  completedMissionSchema.array().safeParse(value);
export const parseRootsOptions = (value: unknown) =>
  rootsOptionsSchema.safeParse(value);
export const parseRootsExports = (value: unknown) =>
  rootsExportSchema.array().safeParse(value);
