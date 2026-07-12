const XP_PER_CORRECT = 10;
const PERFECT_LESSON_BONUS = 20;

/**
 * Inputs for computing the XP earned from a completed lesson.
 */
export interface XpInput {
  readonly correctCount: number;
  readonly questionCount: number;
}

/**
 * Computes XP earned from a lesson, with a bonus for a perfect run.
 * @param input - The correct-answer count and total question count.
 * @returns The total XP earned.
 */
export const calculateXp = (input: XpInput): number => {
  const base = input.correctCount * XP_PER_CORRECT;
  const isPerfect = input.questionCount > 0 && input.correctCount === input.questionCount;

  return base + (isPerfect ? PERFECT_LESSON_BONUS : 0);
};
