import { z } from "zod";

export const villageClusterRecommendationSchema = z
  .object({
    country_id: z.string().uuid(),
    country_name: z.string().min(2).max(120),
    city: z.string().min(2).max(120),
    family_count: z.number().int().min(7),
    child_age_ranges: z.array(z.string().min(3).max(5)).min(3),
    radius_km: z.literal(30),
  })
  .strict();

export type VillageClusterRecommendation = z.infer<
  typeof villageClusterRecommendationSchema
>;

export const parseVillageClusterRecommendations = (value: unknown) =>
  villageClusterRecommendationSchema.array().safeParse(value);
