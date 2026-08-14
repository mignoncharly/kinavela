import { z } from "zod";

import { locales } from "@/lib/i18n/config";
import { invitationTokenSchema } from "@/lib/validation/invitations";

export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const passwordSchema = z
  .string()
  .min(12, "Use at least 12 characters")
  .max(128)
  .regex(/[a-z]/, "Add a lowercase letter")
  .regex(/[A-Z]/, "Add an uppercase letter")
  .regex(/[0-9]/, "Add a number");

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().trim().min(2).max(80),
  locale: z.enum(locales),
  acceptTerms: z.literal(true),
  acceptPrivacy: z.literal(true),
  website: z.string().max(0).optional().default(""),
  invite_token: invitationTokenSchema.optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
  locale: z.enum(locales),
  invite_token: invitationTokenSchema.optional(),
});

export const emailActionSchema = z.object({
  email: emailSchema,
  locale: z.enum(locales),
});

export const updatePasswordSchema = z.object({ password: passwordSchema });
