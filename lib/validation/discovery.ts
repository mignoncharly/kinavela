import { z } from "zod";

import { locales } from "@/lib/i18n/config";

const uuid = z.string().uuid();
const cityName = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .refine(
    (value) =>
      /^[\p{L}\p{M}\s.'’-]+$/u.test(value) ||
      /^[A-Za-z0-9 -]{3,10}$/.test(value),
    "Enter a city or postcode, not a street address.",
  );

export const citySearchSchema = z.object({
  query: cityName,
  country: z.string().regex(/^[A-Z]{2}$/),
  locale: z.enum(locales),
});

export const locationUpdateSchema = z.object({
  location_place_id: z.string().trim().min(3).max(160),
  radius_km: z.number().int().min(5).max(100),
});

export const discoveryBlockSchema = z.object({
  family_id: uuid,
  blocked: z.boolean(),
});

const optionalUuid = z.preprocess(
  (value) => (value === "" || value === undefined ? undefined : value),
  uuid.optional(),
);
const optionalNumber = (minimum: number, maximum: number) =>
  z.preprocess(
    (value) =>
      value === "" || value === undefined ? undefined : Number(value),
    z.number().int().min(minimum).max(maximum).optional(),
  );

export const discoverySearchSchema = z
  .object({
    radius: optionalNumber(5, 100),
    country: z.preprocess(
      (value) => (value === "" || value === undefined ? undefined : value),
      z
        .string()
        .regex(/^[A-Z]{2}$/)
        .optional(),
    ),
    culture: optionalUuid,
    language: optionalUuid,
    interest: optionalUuid,
    minAge: optionalNumber(0, 20),
    maxAge: optionalNumber(0, 20),
    weekday: optionalNumber(0, 6),
    period: z.preprocess(
      (value) => (value === "" || value === undefined ? undefined : value),
      z.enum(["morning", "afternoon", "evening"]).optional(),
    ),
  })
  .refine(
    (value) =>
      value.minAge === undefined ||
      value.maxAge === undefined ||
      value.minAge <= value.maxAge,
    { message: "The minimum age must not exceed the maximum age." },
  )
  .refine(
    (value) => (value.weekday === undefined) === (value.period === undefined),
    { message: "Availability requires both a day and period." },
  );

export const blockedFamilySchema = z.object({
  family_id: uuid,
  family_name: z.string().min(2).max(100),
  blocked_at: z.string().datetime({ offset: true }),
});

export type CitySearchInput = z.infer<typeof citySearchSchema>;
