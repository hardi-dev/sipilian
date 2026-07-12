import type { SubtestKind } from "./domain";
import type { Result } from "./result";
import { err, ok } from "./result";

const POINTS_PER_CORRECT = 5;

/**
 * Machine-readable code for a handled scoring failure.
 */
export type ScoringErrorCode =
  "negative_correct_count" | "non_integer_correct_count" | "invalid_tkp_weight";

/**
 * A handled scoring error returned instead of throwing.
 */
export interface ScoringError {
  readonly code: ScoringErrorCode;
  readonly message: string;
}

/**
 * The score of a single subtest against its passing grade.
 */
export interface SubtestScore {
  readonly kind: SubtestKind;
  readonly rawScore: number;
  readonly passingGrade: number;
  readonly passed: boolean;
}

/**
 * Inputs for scoring an objective (TWK/TIU) subtest.
 */
export interface ObjectiveScoreInput {
  readonly kind: SubtestKind;
  readonly correctCount: number;
  readonly passingGrade: number;
}

/**
 * Scores an objective subtest where each correct answer is worth five points.
 * @param input - The subtest kind, correct-answer count, and passing grade.
 * @returns Ok with the subtest score, or Err when the correct count is negative.
 */
export const scoreObjectiveSubtest = (
  input: ObjectiveScoreInput,
): Result<SubtestScore, ScoringError> => {
  if (!Number.isInteger(input.correctCount)) {
    return err({ code: "non_integer_correct_count", message: "correctCount must be an integer" });
  }

  if (input.correctCount < 0) {
    return err({ code: "negative_correct_count", message: "correctCount must be >= 0" });
  }

  const rawScore = input.correctCount * POINTS_PER_CORRECT;

  return ok({
    kind: input.kind,
    rawScore,
    passingGrade: input.passingGrade,
    passed: rawScore >= input.passingGrade,
  });
};

/**
 * Inputs for scoring a TKP subtest where every selected option carries a 1..5 weight.
 */
export interface TkpScoreInput {
  readonly selectedWeights: readonly number[];
  readonly passingGrade: number;
}

/**
 * Scores a TKP subtest by summing option weights; there are no wrong answers.
 * @param input - The selected option weights and the passing grade.
 * @returns Ok with the subtest score, or Err when any weight is outside 1..5.
 */
export const scoreTkpSubtest = (input: TkpScoreInput): Result<SubtestScore, ScoringError> => {
  const hasInvalidWeight = input.selectedWeights.some(
    (weight) => !Number.isInteger(weight) || weight < 1 || weight > 5,
  );

  if (hasInvalidWeight) {
    return err({ code: "invalid_tkp_weight", message: "TKP weights must be within 1..5" });
  }

  const rawScore = input.selectedWeights.reduce((sum, weight) => sum + weight, 0);

  return ok({
    kind: "tkp",
    rawScore,
    passingGrade: input.passingGrade,
    passed: rawScore >= input.passingGrade,
  });
};

/**
 * The aggregate result of a full CAT tryout across all subtests.
 */
export interface TryoutScore {
  readonly subtests: readonly SubtestScore[];
  readonly totalScore: number;
  readonly passedAll: boolean;
}

/**
 * Aggregates per-subtest scores into an overall tryout result.
 * @param subtests - The already-scored subtests making up the tryout.
 * @returns The combined total and whether every subtest passed.
 */
export const scoreTryout = (subtests: readonly SubtestScore[]): TryoutScore => {
  const totalScore = subtests.reduce((sum, subtest) => sum + subtest.rawScore, 0);

  return {
    subtests,
    totalScore,
    passedAll: subtests.length > 0 && subtests.every((subtest) => subtest.passed),
  };
};
