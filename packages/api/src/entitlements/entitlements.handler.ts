import { ok, type Result } from "@sipilian/core";
import { entitlements } from "@sipilian/db/schema";

import type { RequestContext } from "../context";
import type { PlanTier, SetEntitlementInput } from "./entitlements.schema";

/**
 * The result of setting a user's entitlement.
 */
export interface SetEntitlementResult {
  readonly userId: string;
  readonly plan: PlanTier;
}

/**
 * Sets or updates a user's entitlement plan. Uses userId as the conflict target
 * so the upsert is naturally idempotent.
 * @param input - The userId, plan, and optional expiry.
 * @param ctx - The request context.
 * @returns Ok with the user id and plan.
 */
export async function setEntitlement(
  input: SetEntitlementInput,
  ctx: RequestContext,
): Promise<Result<SetEntitlementResult, never>> {
  const values = {
    userId: input.userId,
    plan: input.plan,
    expiresAt: input.expiresAt,
    updatedAt: ctx.now,
  };

  await ctx.db.insert(entitlements).values(values).onConflictDoUpdate({
    target: entitlements.userId,
    set: { plan: input.plan, expiresAt: values.expiresAt, updatedAt: ctx.now },
  });

  return ok({ userId: input.userId, plan: input.plan });
}
