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

const MS_PER_DAY = 86_400_000;

/**
 * A user's streak state anchored to server-provided activity dates.
 */
export interface StreakState {
  readonly currentStreak: number;
  readonly longestStreak: number;
  readonly lastActivityDate: string;
}

/**
 * Inputs for advancing a streak with a new activity date.
 */
export interface StreakInput {
  readonly previous: StreakState;
  readonly activityDate: string;
}

/**
 * Computes whole-day distance between two ISO yyyy-mm-dd dates in UTC.
 * @param fromIso - The earlier ISO date.
 * @param toIso - The later ISO date.
 * @returns The number of whole days from the first date to the second.
 */
const dayDifference = (fromIso: string, toIso: string): number => {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);

  return Math.round((to - from) / MS_PER_DAY);
};

/**
 * Advances a streak given a new server-dated activity.
 * @param input - The previous streak state and the new activity date.
 * @returns The updated streak state.
 */
export const updateStreak = (input: StreakInput): StreakState => {
  const { previous, activityDate } = input;
  const gap = dayDifference(previous.lastActivityDate, activityDate);

  if (gap === 0) {
    return previous;
  }

  const currentStreak = gap === 1 ? previous.currentStreak + 1 : 1;

  return {
    currentStreak,
    longestStreak: Math.max(previous.longestStreak, currentStreak),
    lastActivityDate: activityDate,
  };
};
