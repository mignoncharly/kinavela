import { z } from "zod";

export const missionCategories = [
  "language",
  "cooking",
  "history",
  "geography",
  "music",
  "storytelling",
  "traditions",
  "family",
  "travel",
  "games",
] as const;

const uuid = z.string().uuid();

export const missionActionSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("start"),
      mission_id: uuid,
      village_mission_id: uuid.nullable().optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal("complete_step"),
      mission_id: uuid,
      step_id: uuid,
      village_mission_id: uuid.nullable().optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal("assign"),
      village_id: uuid,
      mission_id: uuid,
    })
    .strict(),
]);

export const missionStepSchema = z
  .object({
    step_id: uuid,
    position: z.number().int().min(1).max(20),
    title: z.string().min(2).max(120),
    description: z.string().min(10).max(1000),
  })
  .strict();

const missionFields = {
  mission_id: uuid,
  slug: z.string().min(3).max(120),
  title: z.string().min(3).max(160),
  summary: z.string().min(10).max(300),
  description: z.string().min(10).max(2000),
  category: z.enum(missionCategories),
  culture_id: uuid.nullable(),
  culture_name: z.string().min(2).max(120).nullable(),
  country_name: z.string().min(2).max(120).nullable(),
  min_age: z.number().int().min(0).max(20),
  max_age: z.number().int().min(0).max(20),
  estimated_minutes: z.number().int().min(5).max(480),
  cultural_context: z.string().min(20).max(2000),
  materials: z.string().min(2).max(240).array().min(1).max(12),
  guardian_guidance: z.string().min(20).max(2000),
  respectful_attribution: z.string().min(20).max(2000),
  passport_reflection_prompt: z.string().min(10).max(1000),
  context_scope: z.enum(["country", "community", "family"]),
  content_version: z.number().int().min(1).max(32767),
  content_locale: z.enum(["de", "fr", "en"]),
  steps: missionStepSchema.array().min(1).max(20),
  progress_id: uuid.nullable(),
  progress_status: z.enum(["started", "completed"]).nullable(),
  completed_step_ids: uuid.array(),
  completed_at: z.string().datetime({ offset: true }).nullable(),
};

export const culturalMissionSchema = z.object(missionFields).strict();

export const villageMissionSchema = z
  .object({
    village_mission_id: uuid,
    ...missionFields,
    assigned_at: z.string().datetime({ offset: true }),
  })
  .strict();

export type CulturalMission = z.infer<typeof culturalMissionSchema>;
export type VillageMission = z.infer<typeof villageMissionSchema>;

export const parseCulturalMissions = (value: unknown) =>
  culturalMissionSchema.array().safeParse(value);
export const parseVillageMissions = (value: unknown) =>
  villageMissionSchema.array().safeParse(value);
