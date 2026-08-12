import { z } from "zod";

const recommendationCountrySchema = z.object({
  country_id: z.string().uuid(),
});

export const villageRecommendationActionSchema = z.discriminatedUnion(
  "action",
  [
    recommendationCountrySchema
      .extend({ action: z.literal("dismiss") })
      .strict(),
    recommendationCountrySchema
      .extend({
        action: z.literal("start"),
        name: z.string().trim().min(3).max(100),
        description: z.string().trim().min(10).max(1000),
      })
      .strict(),
  ],
);
