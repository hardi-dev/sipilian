import { ok, type Result, type ReviewState, scheduleReview } from "@sipilian/core";
import type { Db } from "@sipilian/db";
import { userQuestionStates } from "@sipilian/db/schema";
import { and, eq } from "drizzle-orm";

import type { RequestContext } from "../context";
import type { SyncProgressInput } from "./progress.schema";

/**
 * The result of syncing question review progress.
 */
export interface SyncResult {
  readonly synced: number;
}

/**
 * Loads the existing review state for a question, or returns default start values.
 * @param database - The Drizzle instance.
 * @param userId - The acting user's id.
 * @param questionId - The question to look up.
 * @returns The existing or default ReviewState.
 */
async function loadCurrentState(
  database: Db,
  userId: string,
  questionId: string,
): Promise<ReviewState> {
  const [existing] = await database
    .select()
    .from(userQuestionStates)
    .where(
      and(eq(userQuestionStates.userId, userId), eq(userQuestionStates.questionId, questionId)),
    );

  if (existing === undefined) {
    return { repetitions: 0, intervalDays: 0, easeFactor: 2.5 };
  }

  return {
    repetitions: existing.repetitions,
    intervalDays: existing.intervalDays,
    easeFactor: Number(existing.easeFactor),
  };
}

/**
 * Upserts the SM-2 review state for a single question after a sync attempt.
 * @param ctx - The request context.
 * @param questionId - The question being reviewed.
 * @param quality - The recall quality (0-5).
 */
async function upsertQuestionProgress(
  ctx: RequestContext,
  questionId: string,
  quality: number,
): Promise<void> {
  const previous = await loadCurrentState(ctx.db, ctx.userId, questionId);
  const state = scheduleReview({ previous, quality });
  const nextReviewAt = new Date(ctx.now.getTime() + state.intervalDays * 86_400_000);
  const rv = {
    userId: ctx.userId,
    questionId,
    repetitions: state.repetitions,
    intervalDays: state.intervalDays,
    easeFactor: state.easeFactor.toFixed(2),
    nextReviewAt,
    lastReviewedAt: ctx.now,
  };

  await ctx.db
    .insert(userQuestionStates)
    .values(rv)
    .onConflictDoUpdate({
      target: [userQuestionStates.userId, userQuestionStates.questionId],
      set: rv,
    });
}

/**
 * Syncs the user's review progress for one or more questions, creating or updating
 * their SM-2 spaced-repetition state. Naturally idempotent via upsert.
 * @param input - The items and their recall qualities.
 * @param ctx - The request context.
 * @returns Ok with the count of synced items.
 */
export async function syncProgress(
  input: SyncProgressInput,
  ctx: RequestContext,
): Promise<Result<SyncResult, never>> {
  for (const question of input.items) {
    await upsertQuestionProgress(ctx, question.questionId, question.quality);
  }

  return ok({ synced: input.items.length });
}
