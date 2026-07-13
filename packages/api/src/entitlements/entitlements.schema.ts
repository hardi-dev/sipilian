import { z } from "zod";

/**
 * Entitlement plan tiers used by the freemium model.
 */
export type PlanTier = "free" | "premium";

/**
 * Input schema for setting a user's entitlement plan.
 */
export const setEntitlementInputSchema = z.object({
  userId: z.uuid(),
  plan: z.enum(["free", "premium"]),
  expiresAt: z.coerce.date().nullable(),
});

export type SetEntitlementInput = z.infer<typeof setEntitlementInputSchema>;
