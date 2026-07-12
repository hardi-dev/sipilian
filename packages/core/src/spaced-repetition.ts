const MIN_EASE_FACTOR = 1.3;
const SECOND_INTERVAL_DAYS = 6;

/**
 * Per-question spaced-repetition state persisted between reviews.
 */
export interface ReviewState {
  readonly repetitions: number;
  readonly intervalDays: number;
  readonly easeFactor: number;
}

/**
 * Inputs for scheduling the next review of a question.
 */
export interface ScheduleReviewInput {
  readonly previous: ReviewState;
  readonly quality: number;
}

/**
 * Computes the next ease factor, clamped to a lower bound.
 * @param current - The current ease factor.
 * @param quality - The recall quality from 0 to 5.
 * @returns The updated ease factor, never below the floor.
 */
const nextEaseFactor = (current: number, quality: number): number => {
  const gap = 5 - quality;
  const updated = current + (0.1 - gap * (0.08 + gap * 0.02));

  return Math.max(MIN_EASE_FACTOR, updated);
};

/**
 * Computes the next interval in days from the repetition count and ease factor.
 * @param repetitions - The successful-review count including the current one.
 * @param previousInterval - The prior interval in days.
 * @param easeFactor - The current ease factor.
 * @returns The next interval in whole days.
 */
const nextInterval = (
  repetitions: number,
  previousInterval: number,
  easeFactor: number,
): number => {
  if (repetitions <= 1) {
    return 1;
  }

  if (repetitions === 2) {
    return SECOND_INTERVAL_DAYS;
  }

  return Math.round(previousInterval * easeFactor);
};

/**
 * Schedules the next review using a simplified SM-2 algorithm.
 * @param input - The previous review state and the recall quality (0..5).
 * @returns The next review state; a lapse (quality < 3) resets progress.
 */
export const scheduleReview = (input: ScheduleReviewInput): ReviewState => {
  const { previous, quality } = input;

  if (quality < 3) {
    return { repetitions: 0, intervalDays: 1, easeFactor: previous.easeFactor };
  }

  const repetitions = previous.repetitions + 1;
  const easeFactor = nextEaseFactor(previous.easeFactor, quality);

  return {
    repetitions,
    intervalDays: nextInterval(repetitions, previous.intervalDays, easeFactor),
    easeFactor,
  };
};
