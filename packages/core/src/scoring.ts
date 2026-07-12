import type { SubtestKind } from "./domain";
import type { Result } from "./result";
import { err, ok } from "./result";

const POINTS_PER_CORRECT = 5;

/**
 * Machine-readable code for a handled scoring failure.
 */
export type ScoringErrorCode = "negative_correct_count" | "invalid_tkp_weight";

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
