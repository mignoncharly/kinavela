import { z } from "zod";

const uuid = z.string().uuid();
const currentYear = new Date().getUTCFullYear();

export const childVisibilitySchema = z.enum(["guardians", "connections"]);
export const cultureRelationshipSchema = z.enum([
  "origin",
  "heritage",
  "connection",
  "interest",
]);
export const languageProficiencySchema = z.enum([
  "beginner",
  "conversational",
  "fluent",
  "native",
]);
export const languageGoalSchema = z.enum([
  "already_speaking",
  "learning",
  "want_to_teach_children",
  "cultural_interest",
]);
export const preservationGoalSchema = z.enum([
  "language",
  "stories",
  "recipes",
  "traditions",
  "history",
  "music",
  "family_connections",
]);
export const availabilityPeriodSchema = z.enum([
  "morning",
  "afternoon",
  "evening",
]);

const uniqueBy = <T>(items: T[], key: (item: T) => string) =>
  new Set(items.map(key)).size === items.length;

export const familySettingsSchema = z
  .object({
    family: z
      .object({
        name: z.string().trim().min(2).max(100),
        bio: z.string().trim().max(600),
        visibility: z.enum(["private", "discoverable"]),
      })
      .strict(),
    children: z
      .array(
        z
          .object({
            id: uuid.nullable(),
            nickname: z.string().trim().min(1).max(40),
            birth_year: z.number().int().min(2005).max(currentYear),
            birth_month: z.number().int().min(1).max(12).nullable(),
            gender: z
              .enum(["female", "male", "nonbinary", "prefer_not_to_say"])
              .nullable(),
            visibility: childVisibilitySchema,
          })
          .strict(),
      )
      .min(1)
      .max(8)
      .refine(
        (items) =>
          uniqueBy(
            items.filter((item) => item.id !== null),
            (item) => item.id!,
          ),
        "Duplicate child.",
      ),
    cultures: z
      .array(
        z
          .object({
            culture_id: uuid,
            relationship_type: cultureRelationshipSchema,
            priority: z.number().int().min(1).max(5),
          })
          .strict(),
      )
      .min(1)
      .max(8)
      .refine(
        (items) => uniqueBy(items, (item) => item.culture_id),
        "Duplicate culture.",
      ),
    languages: z
      .array(
        z
          .object({
            language_id: uuid,
            proficiency: languageProficiencySchema,
            transmission_goal: languageGoalSchema,
          })
          .strict(),
      )
      .min(1)
      .max(10)
      .refine(
        (items) => uniqueBy(items, (item) => item.language_id),
        "Duplicate language.",
      ),
    preservation_goals: z.array(preservationGoalSchema).min(1).max(7),
    interest_ids: z
      .array(uuid)
      .min(1)
      .max(16)
      .refine((items) => uniqueBy(items, String), "Duplicate interest."),
    availability: z
      .array(
        z
          .object({
            weekday: z.number().int().min(0).max(6),
            period: availabilityPeriodSchema,
          })
          .strict(),
      )
      .min(1)
      .max(21)
      .refine(
        (items) => uniqueBy(items, (item) => `${item.weekday}:${item.period}`),
        "Duplicate availability slot.",
      ),
    preferences: z
      .object({
        same_country_priority: z.number().int().min(0).max(5),
        same_culture_priority: z.number().int().min(0).max(5),
        similar_child_age_priority: z.number().int().min(0).max(5),
        same_language_priority: z.number().int().min(0).max(5),
        shared_interests_priority: z.number().int().min(0).max(5),
        availability_priority: z.number().int().min(0).max(5),
        open_to_other_african_families: z.boolean(),
        open_to_all_diaspora_families: z.boolean(),
        min_child_age: z.number().int().min(0).max(20),
        max_child_age: z.number().int().min(0).max(20),
      })
      .strict(),
  })
  .strict()
  .refine(
    (value) =>
      value.preferences.min_child_age <= value.preferences.max_child_age,
    { message: "Invalid child age range.", path: ["preferences"] },
  );

export type FamilySettingsInput = z.infer<typeof familySettingsSchema>;

export const familySettingsResponseSchema = z
  .object({
    ok: z.boolean(),
    error: z.string().optional(),
    familyId: uuid.optional(),
  })
  .strict();
