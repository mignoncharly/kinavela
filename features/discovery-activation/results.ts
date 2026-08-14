import { z } from "zod";

export const discoveryAlertSchema = z
  .object({
    subscription_id: z.string().uuid(),
    active: z.boolean(),
    radius_km: z.number().int().min(5).max(100),
    last_evaluated_at: z.string().datetime({ offset: true }).nullable(),
    created_at: z.string().datetime({ offset: true }),
  })
  .strict();

export type DiscoveryAlert = z.infer<typeof discoveryAlertSchema>;

export const parseDiscoveryAlert = (value: unknown) =>
  discoveryAlertSchema.array().max(1).safeParse(value);
