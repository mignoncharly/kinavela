import { z } from "zod";

export const matchReasonSchema = z.enum([
  "children_similar_age",
  "shared_culture",
  "shared_language",
  "shared_interests",
  "availability_overlap",
  "shared_origin_country",
  "nearby",
]);

export const matchResultSchema = z.object({
  family_id: z.string().uuid(),
  family_name: z.string().min(2).max(100),
  display_city: z.string().min(2).max(140),
  distance_bucket: z.enum([
    "<5 km",
    "5-10 km",
    "10-20 km",
    "20-30 km",
    "30-50 km",
    "50-100 km",
  ]),
  match_score: z.number().int().min(0).max(100),
  child_age_ranges: z.array(z.string()),
  cultures: z.array(z.string()),
  languages: z.array(z.string()),
  shared_interests: z.array(z.string()),
  compatibility_reasons: z.array(matchReasonSchema),
});

export type MatchResult = z.infer<typeof matchResultSchema>;
export type MatchReason = z.infer<typeof matchReasonSchema>;

export function parseMatchResults(value: unknown) {
  return matchResultSchema.array().safeParse(value);
}
