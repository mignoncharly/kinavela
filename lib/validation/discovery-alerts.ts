import { z } from "zod";

export const discoveryAlertActionSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("subscribe"),
      radius_km: z.number().int().min(5).max(100),
    })
    .strict(),
  z.object({ action: z.literal("revoke") }).strict(),
]);
