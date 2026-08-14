import { z } from "zod";

import { locales } from "@/lib/i18n/config";

const uuid = z.string().uuid();
const child = z.object({
  nickname: z.string().trim().min(1).max(40),
  birth_year: z.number().int().min(2005).max(new Date().getUTCFullYear()),
  birth_month: z.number().int().min(1).max(12).nullable(),
  gender: z
    .enum(["female", "male", "nonbinary", "prefer_not_to_say"])
    .nullable(),
});

export const onboardingDraftSchema = z
  .object({
    version: z.literal(1),
    step: z.number().int().min(0).max(6),
    children: z.array(z.number().int().positive()).min(1).max(8),
    languageRows: z.array(z.number().int().positive()).min(1).max(10),
    availabilityRows: z.array(z.number().int().positive()).min(1).max(21),
    values: z
      .record(
        z.string().min(1).max(80),
        z.union([z.string().max(600), z.array(z.string().max(160)).max(21)]),
      )
      .refine(
        (values) =>
          Object.keys(values).length <= 100 &&
          Object.keys(values).every(
            (key) => !/(password|token|secret|email)/i.test(key),
          ),
      ),
  })
  .strict();

export const onboardingSchema = z.object({
  display_name: z.string().trim().min(2).max(80),
  preferred_language: z.enum(locales),
  timezone: z.string().trim().min(3).max(64),
  family: z.object({
    name: z.string().trim().min(2).max(100),
    country_of_residence: z.string().regex(/^[A-Z]{2}$/),
    city: z.string().trim().min(2).max(120),
    location_place_id: z.string().trim().min(3).max(160),
    radius_km: z.number().int().min(5).max(100),
    visibility: z.enum(["private", "discoverable"]),
    bio: z.string().trim().max(600),
  }),
  children: z.array(child).min(1).max(8),
  culture_ids: z.array(uuid).min(1).max(8),
  languages: z
    .array(
      z.object({
        language_id: uuid,
        proficiency: z.enum(["beginner", "conversational", "fluent", "native"]),
        transmission_goal: z.enum([
          "already_speaking",
          "learning",
          "want_to_teach_children",
          "cultural_interest",
        ]),
      }),
    )
    .min(1)
    .max(10)
    .refine(
      (items) =>
        new Set(items.map((item) => item.language_id)).size === items.length,
      "duplicate_language",
    ),
  preservation_goals: z
    .array(
      z.enum([
        "language",
        "stories",
        "recipes",
        "traditions",
        "history",
        "music",
        "family_connections",
      ]),
    )
    .min(1),
  interest_ids: z.array(uuid).min(1).max(16),
  availability: z
    .array(
      z.object({
        weekday: z.number().int().min(0).max(6),
        period: z.enum(["morning", "afternoon", "evening"]),
      }),
    )
    .min(1)
    .max(21)
    .refine(
      (items) =>
        new Set(items.map((item) => `${item.weekday}:${item.period}`)).size ===
        items.length,
      "duplicate_availability",
    ),
  preferences: z.object({
    open_to_other_african_families: z.boolean(),
    open_to_all_diaspora_families: z.boolean(),
    min_child_age: z.number().int().min(0).max(20),
    max_child_age: z.number().int().min(0).max(20),
  }),
  accept_community_guidelines: z.literal(true),
});

export type OnboardingDraft = z.infer<typeof onboardingDraftSchema>;
export type OnboardingInput = z.infer<typeof onboardingSchema>;
