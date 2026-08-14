import { z } from "zod";

export const createdInvitationSchema = z
  .object({
    invitation_id: z.string().uuid(),
    raw_token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    expires_at: z.string().datetime({ offset: true }),
  })
  .strict();

export const publicInvitationSchema = z
  .object({
    invitation_kind: z.enum(["family_referral", "village"]),
    invitation_locale: z.enum(["de", "fr", "en"]),
    village_name: z.string().min(3).max(100).nullable(),
    village_city: z.string().min(2).max(120).nullable(),
    country_focus_name: z.string().max(120).nullable(),
    event_title: z.string().min(3).max(120).nullable(),
    event_starts_at: z.string().datetime({ offset: true }).nullable(),
    expires_at: z.string().datetime({ offset: true }),
  })
  .strict();

export const invitationClaimResultSchema = z
  .object({
    village_id: z.string().uuid(),
    event_id: z.string().uuid().nullable(),
  })
  .strict();

export function parseCreatedInvitation(value: unknown) {
  return createdInvitationSchema.array().min(1).max(1).safeParse(value);
}

export function parsePublicInvitation(value: unknown) {
  return publicInvitationSchema.array().max(1).safeParse(value);
}

export function parseInvitationClaim(value: unknown) {
  return invitationClaimResultSchema.array().min(1).max(1).safeParse(value);
}
