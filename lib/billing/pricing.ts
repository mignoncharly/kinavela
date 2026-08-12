export const ROOTS_FAMILY_PRICING = {
  monthly: {
    amountCents: 599,
    currency: "EUR",
    interval: "month",
  },
  annual: {
    amountCents: 5999,
    currency: "EUR",
    interval: "year",
  },
} as const;

export const ROOTS_FAMILY_ANNUAL_SAVING_PERCENT = Math.floor(
  ((ROOTS_FAMILY_PRICING.monthly.amountCents * 12 -
    ROOTS_FAMILY_PRICING.annual.amountCents) /
    (ROOTS_FAMILY_PRICING.monthly.amountCents * 12)) *
    100,
);
