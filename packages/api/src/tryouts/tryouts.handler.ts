import { err, isErr, ok } from "@sipilian/core";
import {
  scoreObjectiveSubtest,
  scoreTkpSubtest,
  scoreTryout,
  type SubtestScore,
  type TryoutScore,
} from "@sipilian/core";
import { type Result } from "@sipilian/core";
import type { Db } from "@sipilian/db";
import {
  questionOptions,
  questions,
  subtests,
  topics,
  tryoutAnswers,
  tryoutAttempts,
} from "@sipilian/db/schema";
import { and, eq, inArray } from "drizzle-orm";

import type { RequestContext } from "../context";
import { type ApiError, apiError } from "../http";
import { withIdempotency } from "../idempotency";
import type { StartTryoutInput, SubmitTryoutInput, TryoutAnswer } from "./tryouts.schema";

/**
 * The result returned after starting a tryout attempt.
 */
export interface StartTryoutResult {
  readonly attemptId: string;
}

/**
 * The result returned after submitting and scoring a tryout.
 */
export interface SubmitTryoutResult {
  readonly subtests: readonly SubtestScore[];
  readonly totalScore: number;
  readonly passedAll: boolean;
}

/**
 * Maps a question id to its subtest kind and passing grade.
 */
interface QuestionKindInfo {
  readonly kind: string;
  readonly passingGrade: number;
}

/**
 * Objective subtest kinds (TWK/TIU) where answers are scored by correctness.
 */
type ObjectiveKind = "twk" | "tiu";

/**
 * Extracts the subtest kind prefix from a subtest slug (e.g. "twk-xxx" → "twk").
 * @param slug - The subtest slug.
 * @returns The kind prefix.
 */
function parseSubtestKind(slug: string): string {
  const idx = slug.indexOf("-");

  return idx === -1 ? slug : slug.slice(0, idx);
}

/**
 * Loads a tryout attempt or returns not_found if missing or not owned by the user.
 * @param database - The Drizzle instance.
 * @param attemptId - The attempt to look up.
 * @param userId - The expected owner.
 * @returns Ok with the attempt row, or Err(not_found).
 */
async function loadAttemptOrFail(
  database: Db,
  attemptId: string,
  userId: string,
): Promise<Result<typeof tryoutAttempts.$inferSelect, ApiError>> {
  const [attempt] = await database
    .select()
    .from(tryoutAttempts)
    .where(eq(tryoutAttempts.id, attemptId));

  if (attempt?.userId !== userId) {
    return err(apiError("not_found", "Tryout attempt not found"));
  }

  return ok(attempt);
}

/**
 * Builds a map from question id to subtest kind and passing grade.
 * @param database - The Drizzle instance.
 * @param questionIds - The question ids to look up.
 * @returns A map of question id to kind info.
 */
async function loadQuestionKindMap(
  database: Db,
  questionIds: readonly string[],
): Promise<Map<string, QuestionKindInfo>> {
  const rows = await database
    .select({
      questionId: questions.id,
      slug: subtests.slug,
      passingGrade: subtests.passingGrade,
    })
    .from(questions)
    .innerJoin(topics, eq(topics.id, questions.topicId))
    .innerJoin(subtests, eq(subtests.id, topics.subtestId))
    .where(inArray(questions.id, questionIds));

  const map = new Map<string, QuestionKindInfo>();

  for (const row of rows) {
    map.set(row.questionId, { kind: parseSubtestKind(row.slug), passingGrade: row.passingGrade });
  }

  return map;
}

/**
 * Loads the set of correct option IDs from the given option ids.
 * @param database - The Drizzle instance.
 * @param optionIds - The option ids to check.
 * @returns A set of option IDs that are marked correct.
 */
async function computeCorrectOptionIds(
  database: Db,
  optionIds: readonly string[],
): Promise<Set<string>> {
  const rows = await database
    .select({ id: questionOptions.id })
    .from(questionOptions)
    .where(and(inArray(questionOptions.id, optionIds), eq(questionOptions.isCorrect, true)));

  return new Set(rows.map((r) => r.id));
}

/**
 * Type guard that narrows a TryoutAnswer to one with an optionId.
 * @param answer - The answer to check.
 * @returns True when the answer carries an optionId.
 */
function hasOptionId(answer: TryoutAnswer): answer is TryoutAnswer & { optionId: string } {
  return answer.optionId !== undefined;
}

/**
 * Type guard that narrows a TryoutAnswer to one with a weight.
 * @param answer - The answer to check.
 * @returns True when the answer carries a weight.
 */
function hasWeight(answer: TryoutAnswer): answer is TryoutAnswer & { weight: number } {
  return answer.weight !== undefined;
}

/**
 * Scores an objective subtest (TWK/TIU) from the user's answers.
 * @param database - The Drizzle instance.
 * @param kind - The subtest kind.
 * @param answers - The answers for this subtest (each must have optionId).
 * @param passingGrade - The passing grade for this subtest.
 * @returns Ok with the subtest score, or Err on scoring failure.
 */
async function scoreObjectiveKind(
  database: Db,
  kind: ObjectiveKind,
  answers: readonly (TryoutAnswer & { optionId: string })[],
  passingGrade: number,
): Promise<Result<SubtestScore, ApiError>> {
  const optionIds = answers.map((a) => a.optionId);
  const correctIds = await computeCorrectOptionIds(database, optionIds);
  const correctCount = answers.filter((a) => correctIds.has(a.optionId)).length;
  const result = scoreObjectiveSubtest({ kind, correctCount, passingGrade });

  if (isErr(result)) {
    return err(apiError("unprocessable", result.error.message));
  }

  return ok(result.value);
}

/**
 * Scores a TKP subtest from the user's self-assessed weights.
 * @param answers - The TKP answers with weights (each must have weight).
 * @param passingGrade - The passing grade for this subtest.
 * @returns Ok with the subtest score, or Err on scoring failure.
 */
function scoreTkpKind(
  answers: readonly (TryoutAnswer & { weight: number })[],
  passingGrade: number,
): Result<SubtestScore, ApiError> {
  const result = scoreTkpSubtest({
    selectedWeights: answers.map((a) => a.weight),
    passingGrade,
  });

  if (isErr(result)) {
    return err(apiError("unprocessable", result.error.message));
  }

  return ok(result.value);
}

/**
 * Persists the answer rows for a completed tryout attempt.
 * @param database - The Drizzle instance.
 * @param attemptId - The owning attempt id.
 * @param answers - The answers to persist.
 */
async function saveAnswers(
  database: Db,
  attemptId: string,
  answers: readonly TryoutAnswer[],
): Promise<void> {
  const rows = answers.map((answer) => ({
    attemptId,
    questionId: answer.questionId,
    optionId: answer.optionId ?? null,
    weight: answer.weight ?? null,
  }));

  await database.insert(tryoutAnswers).values(rows);
}

/**
 * Inputs for persisting the scored tryout attempt.
 */
interface UpdateScoresInput {
  readonly database: Db;
  readonly attemptId: string;
  readonly scores: readonly SubtestScore[];
  readonly overall: TryoutScore;
  readonly now: Date;
}

/**
 * Updates the tryout attempt row with computed scores.
 * @param input - The update payload including scores and server timestamp.
 */
async function updateAttemptScores(input: UpdateScoresInput): Promise<void> {
  const twkScore = input.scores.find((s) => s.kind === "twk")?.rawScore ?? null;
  const tiuScore = input.scores.find((s) => s.kind === "tiu")?.rawScore ?? null;
  const tkpScore = input.scores.find((s) => s.kind === "tkp")?.rawScore ?? null;

  await input.database.update(tryoutAttempts).set({
    endedAt: input.now,
    twkScore,
    tiuScore,
    tkpScore,
    totalScore: input.overall.totalScore,
    passedAll: input.overall.passedAll,
  })
    .where(eq(tryoutAttempts.id, input.attemptId));
}

/**
 * Scores one subtest kind from the filtered answers, looking up the passing grade.
 * @param database - The Drizzle instance.
 * @param kind - The kind to score.
 * @param kindAnswers - The answers belonging to this kind.
 * @param kindMap - Map from question id to kind info.
 * @returns Ok with the subtest score, or Err on scoring failure.
 */
async function scoreOneKind(
  database: Db,
  kind: string,
  kindAnswers: readonly TryoutAnswer[],
  kindMap: Map<string, QuestionKindInfo>,
): Promise<Result<SubtestScore, ApiError>> {
  const first = kindAnswers[0];

  if (first === undefined) {
    return err(apiError("unprocessable", `No answers for subtest ${kind}`));
  }

  const info = kindMap.get(first.questionId);

  if (info === undefined) {
    return err(apiError("unprocessable", `Unknown question ${first.questionId}`));
  }

  if (kind === "tkp") {
    return scoreTkpKind(kindAnswers.filter(hasWeight), info.passingGrade);
  }

  return scoreObjectiveKind(database, kind as ObjectiveKind, kindAnswers.filter(hasOptionId), info.passingGrade);
}

/**
 * Scores every subtest kind present in the answers and returns per-kind scores.
 * @param database - The Drizzle instance.
 * @param answers - All submitted answers.
 * @param kindMap - Map from question id to kind info.
 * @returns Ok with an ordered list of per-subtest scores, or Err on scoring failure.
 */
async function computeScores(
  database: Db,
  answers: readonly TryoutAnswer[],
  kindMap: Map<string, QuestionKindInfo>,
): Promise<Result<readonly SubtestScore[], ApiError>> {
  const scores: SubtestScore[] = [];
  const kinds: readonly string[] = ["twk", "tiu", "tkp"];

  for (const kind of kinds) {
    const kindAnswers = answers.filter(
      (a) => kindMap.get(a.questionId)?.kind === kind,
    );

    if (kindAnswers.length === 0) continue;

    const result = await scoreOneKind(database, kind, kindAnswers, kindMap);

    if (isErr(result)) return result;

    scores.push(result.value);
  }

  return ok(scores);
}

/**
 * Runs the idempotent side-effects inside submitTryout.
 * @param input - The validated tryout submission.
 * @param ctx - The request context.
 * @returns Ok with the scored result, or an API error.
 */
async function executeSubmit(
  input: SubmitTryoutInput,
  ctx: RequestContext,
): Promise<Result<SubmitTryoutResult, ApiError>> {
  const attemptResult = await loadAttemptOrFail(ctx.db, input.attemptId, ctx.userId);

  if (isErr(attemptResult)) return attemptResult;

  const kindMap = await loadQuestionKindMap(ctx.db, input.answers.map((a) => a.questionId));
  const scoresResult = await computeScores(ctx.db, input.answers, kindMap);

  if (isErr(scoresResult)) return scoresResult;

  const overall = scoreTryout(scoresResult.value);

  await saveAnswers(ctx.db, attemptResult.value.id, input.answers);
  await updateAttemptScores({
    database: ctx.db,
    attemptId: attemptResult.value.id,
    scores: scoresResult.value,
    overall,
    now: ctx.now,
  });

  return ok({ subtests: scoresResult.value, totalScore: overall.totalScore, passedAll: overall.passedAll });
}

/**
 * Starts a new tryout attempt for the given package.
 * @param input - The package id to attempt.
 * @param ctx - The request context.
 * @returns Ok with the attempt id and question views, or Err(not_found).
 */
export async function startTryout(
  input: StartTryoutInput,
  ctx: RequestContext,
): Promise<Result<StartTryoutResult, ApiError>> {
  const [attempt] = await ctx.db
    .insert(tryoutAttempts)
    .values({ userId: ctx.userId, packageId: input.packageId, startedAt: ctx.now })
    .returning({ id: tryoutAttempts.id });

  if (attempt === undefined) {
    return err(apiError("unprocessable", "Failed to create tryout attempt"));
  }

  return ok({ attemptId: attempt.id });
}

/**
 * Submits a completed tryout: scores each subtest, persists answers, and returns the result.
 * @param input - The validated tryout submission.
 * @param ctx - The request context.
 * @returns Ok with the scored result (idempotent by idempotencyKey).
 */
export async function submitTryout(
  input: SubmitTryoutInput,
  ctx: RequestContext,
): Promise<Result<SubmitTryoutResult, ApiError>> {
  return withIdempotency(ctx, input.idempotencyKey, () => executeSubmit(input, ctx));
}
