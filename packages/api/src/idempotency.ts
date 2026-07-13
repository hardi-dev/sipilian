import { isErr, ok, type Result } from "@sipilian/core";
import { requestIdempotency } from "@sipilian/db/schema";
import { and, eq } from "drizzle-orm";

import type { RequestContext } from "./context";

/**
 * Reads a previously stored idempotent response for the given user + key.
 * @param ctx - The request context providing db + userId.
 * @param key - The idempotency key to look up.
 * @returns The stored output, or undefined when no record exists.
 */
async function lookupCachedResult(ctx: RequestContext, key: string): Promise<unknown> {
  const [row] = await ctx.db
    .select()
    .from(requestIdempotency)
    .where(and(eq(requestIdempotency.userId, ctx.userId), eq(requestIdempotency.key, key)));

  return row?.response;
}

/**
 * Persists a successful response for the given user + key.
 * @param ctx - The request context providing db + userId.
 * @param key - The idempotency key.
 * @param response - The successful response to store.
 */
async function storeResult(ctx: RequestContext, key: string, response: unknown): Promise<void> {
  await ctx.db.insert(requestIdempotency).values({ userId: ctx.userId, key, response });
}

/**
 * Runs a mutation at most once per (user, key); replays the stored Ok result on retry.
 * @param ctx - The request context providing db + userId.
 * @param key - The client-supplied idempotency key.
 * @param fn - The mutation to run when the key is unseen.
 * @returns The fresh or replayed Result; Err results are not cached.
 */
export async function withIdempotency<Output, ApiErr>(
  ctx: RequestContext,
  key: string,
  fn: () => Promise<Result<Output, ApiErr>>,
): Promise<Result<Output, ApiErr>> {
  const cached = await lookupCachedResult(ctx, key);

  if (cached !== undefined) {
    return ok(cached as Output);
  }

  const result = await fn();

  if (isErr(result)) {
    return result;
  }

  await storeResult(ctx, key, result.value);

  return result;
}
