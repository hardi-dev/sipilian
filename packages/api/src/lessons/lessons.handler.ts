import type { Result } from "@sipilian/core";
import { calculateXp, ok, scheduleReview, updateStreak } from "@sipilian/core";
import type { Db } from "@sipilian/db";
import {
  dailyActivity,
  lessonCompletions,
  questionOptions,
  userQuestionStates,
  userStats,
} from "@sipilian/db/schema";
import { and, eq, inArray } from "drizzle-orm";

import type { RequestContext } from "../context";
import type { ApiError } from "../http";
import { withIdempotency } from "../idempotency";
import type { SubmitLessonInput } from "./lessons.schema";

/**
 * The outcome of a submitted lesson.
 */
export interface LessonResult {
  readonly correctCount: number;
  readonly xpEarned: number;
  readonly currentStreak: number;
}

/**
 * Formats a Date as a UTC yyyy-mm-dd day string.
 * @param date - The date to format.
 * @returns The ISO day string.
 */
function toIsoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Counts how many submitted answers selected the correct option.
 * @param database - The Drizzle instance.
 * @param answers - The submitted answers.
 * @returns The number of correct answers.
 */
async function countCorrect(
  database: Db,
  answers: SubmitLessonInput["answers"],
): Promise<number> {
  const optionIds = answers.map((answer) => answer.optionId);
  const correctRows = await database
    .select({ id: questionOptions.id })
    .from(questionOptions)
    .where(and(inArray(questionOptions.id, optionIds), eq(questionOptions.isCorrect, true)));

  return correctRows.length;
}

/**
 * Inserts the initial user_stats row with streak = 1; safe against races.
 * @param ctx - The request context.
 * @param today - Today's ISO day string.
 * @returns Always 1.
 */
async function createInitialStats(ctx: RequestContext, today: string): Promise<number> {
  await ctx.db
    .insert(userStats)
    .values({ userId: ctx.userId, currentStreak: 1, longestStreak: 1, lastActivityDate: today })
    .onConflictDoUpdate({
      target: userStats.userId,
      set: { currentStreak: 1, longestStreak: 1, lastActivityDate: today },
    });

  return 1;
}

/**
 * Advances the user's streak given today's activity, creating stats on first run.
 * @param ctx - The request context.
 * @param today - Today's ISO day string.
 * @returns The updated current streak.
 */
async function advanceStreak(ctx: RequestContext, today: string): Promise<number> {
  const [stats] = await ctx.db.select().from(userStats).where(eq(userStats.userId, ctx.userId));

  if (!stats?.lastActivityDate) {
    return createInitialStats(ctx, today);
  }

  const next = updateStreak({
    previous: {
      currentStreak: stats.currentStreak,
      longestStreak: stats.longestStreak,
      lastActivityDate: stats.lastActivityDate,
    },
    activityDate: today,
  });

  await ctx.db.update(userStats).set(next).where(eq(userStats.userId, ctx.userId));

  return next.currentStreak;
}

/**
 * Loads the set of correct option IDs from the submitted answers.
 * @param database - The Drizzle instance.
 * @param answers - The submitted answers.
 * @returns A set of option IDs that are correct.
 */
async function loadCorrectOptionIds(
  database: Db,
  answers: SubmitLessonInput["answers"],
): Promise<Set<string>> {
  const optionIds = answers.map((a) => a.optionId);
  const rows = await database
    .select({ id: questionOptions.id })
    .from(questionOptions)
    .where(and(inArray(questionOptions.id, optionIds), eq(questionOptions.isCorrect, true)));

  return new Set(rows.map((r) => r.id));
}

/**
 * Writes the spaced-repetition review state for a single question.
 * @param ctx - The request context.
 * @param questionId - The question being reviewed.
 * @param quality - The recall quality (0-5) for SM-2 scheduling.
 * @param nextDate - The base date for computing nextReviewAt.
 */
async function upsertReviewState(
  ctx: RequestContext,
  questionId: string,
  quality: number,
  nextDate: Date,
): Promise<void> {
  const state = scheduleReview({
    previous: { repetitions: 0, intervalDays: 0, easeFactor: 2.5 },
    quality,
  });
  const nextReviewAt = new Date(nextDate.getTime() + state.intervalDays * 86_400_000);
  const rv = {
    userId: ctx.userId, questionId,
    repetitions: state.repetitions, intervalDays: state.intervalDays,
    easeFactor: state.easeFactor.toFixed(2), nextReviewAt, lastReviewedAt: ctx.now,
  };

  await ctx.db.insert(userQuestionStates).values(rv).onConflictDoUpdate({
    target: [userQuestionStates.userId, userQuestionStates.questionId], set: rv,
  });
}

/**
 * Schedules the next review for each answered question.
 * @param ctx - The request context.
 * @param answers - The submitted answers with question and option ids.
 */
async function applyReviews(
  ctx: RequestContext,
  answers: SubmitLessonInput["answers"],
): Promise<void> {
  const correctIds = await loadCorrectOptionIds(ctx.db, answers);
  const nextDate = new Date(ctx.now);

  for (const answer of answers) {
    const quality = correctIds.has(answer.optionId) ? 5 : 0;

    await upsertReviewState(ctx, answer.questionId, quality, nextDate);
  }
}

/**
 * Runs the side-effect logic inside withIdempotency.
 * @param input - The validated lesson submission.
 * @param ctx - The request context.
 * @returns The result with correct count, XP earned, and current streak.
 */
async function executeLesson(
  input: SubmitLessonInput,
  ctx: RequestContext,
): Promise<Result<LessonResult, never>> {
  const today = toIsoDay(ctx.now);
  const correctCount = await countCorrect(ctx.db, input.answers);
  const xpEarned = calculateXp({ correctCount, questionCount: input.answers.length });

  await ctx.db.insert(lessonCompletions)
    .values({ userId: ctx.userId, lessonId: input.lessonId, score: correctCount, xp: xpEarned });
  await ctx.db.insert(dailyActivity)
    .values({ userId: ctx.userId, activityDate: today })
    .onConflictDoNothing();

  const currentStreak = await advanceStreak(ctx, today);

  await applyReviews(ctx, input.answers);

  return ok({ correctCount, xpEarned, currentStreak });
}

/**
 * Submits a completed lesson: scores it, awards XP + streak, schedules reviews.
 * @param input - The validated lesson submission.
 * @param ctx - The request context.
 * @returns Ok with the lesson result (idempotent by idempotencyKey).
 */
export async function submitLesson(
  input: SubmitLessonInput,
  ctx: RequestContext,
): Promise<Result<LessonResult, ApiError>> {
  return withIdempotency(ctx, input.idempotencyKey, () => executeLesson(input, ctx));
}
