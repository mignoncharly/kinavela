import { z } from "zod";

import { locales } from "@/lib/i18n/config";

export const invitationTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export const invitationActionSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("create"),
      invitation_kind: z.enum(["family_referral", "village"]),
      village_id: z.string().uuid().nullable().default(null),
      event_id: z.string().uuid().nullable().default(null),
      locale: z.enum(locales),
    })
    .strict()
    .superRefine((value, context) => {
      if (
        (value.invitation_kind === "family_referral" &&
          (value.village_id !== null || value.event_id !== null)) ||
        (value.invitation_kind === "village" && value.village_id === null)
      ) {
        context.addIssue({ code: "custom", message: "invalid_invitation" });
      }
    }),
  z
    .object({
      action: z.literal("revoke"),
      invitation_id: z.string().uuid(),
    })
    .strict(),
  z
    .object({ action: z.literal("attribute"), token: invitationTokenSchema })
    .strict(),
  z
    .object({
      action: z.literal("accept_village"),
      token: invitationTokenSchema,
    })
    .strict(),
]);
