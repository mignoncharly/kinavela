import { z } from "zod";

export const publicCommunityAggregateSchema = z
  .object({
    page_slug: z.string().regex(/^[a-z0-9-]{3,100}$/),
    city_label: z.string().min(2).max(120),
    culture_label: z.string().min(2).max(120),
    residence_label: z.string().min(2).max(120),
    family_count: z.number().int().min(5).nullable(),
    village_count: z.number().int().min(3).nullable(),
    event_count: z.number().int().min(5).nullable(),
    published: z.boolean(),
    last_refreshed_at: z.string().datetime({ offset: true }),
  })
  .strict();
