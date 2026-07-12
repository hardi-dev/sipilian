import { describe, expect, it } from "vitest";

import { scheduleReview } from "./spaced-repetition";

const fresh = { repetitions: 0, intervalDays: 0, easeFactor: 2.5 };

describe("scheduleReview", () => {
  it("schedules the first successful review one day out", () => {
    const next = scheduleReview({ previous: fresh, quality: 4 });

    expect(next.repetitions).toBe(1);
    expect(next.intervalDays).toBe(1);
  });

  it("schedules the second successful review six days out", () => {
    const afterFirst = { repetitions: 1, intervalDays: 1, easeFactor: 2.5 };

    const next = scheduleReview({ previous: afterFirst, quality: 4 });

    expect(next.repetitions).toBe(2);
    expect(next.intervalDays).toBe(6);
  });

  it("grows later intervals by the ease factor", () => {
    const afterSecond = { repetitions: 2, intervalDays: 6, easeFactor: 2.5 };

    const next = scheduleReview({ previous: afterSecond, quality: 5 });

    expect(next.repetitions).toBe(3);
    expect(next.intervalDays).toBeGreaterThan(6);
  });

  it("resets repetitions on a lapse (quality < 3)", () => {
    const strong = { repetitions: 5, intervalDays: 40, easeFactor: 2.6 };

    const next = scheduleReview({ previous: strong, quality: 1 });

    expect(next.repetitions).toBe(0);
    expect(next.intervalDays).toBe(1);
    expect(next.easeFactor).toBe(2.6);
  });

  it("never lets the ease factor fall below 1.3", () => {
    const low = { repetitions: 4, intervalDays: 10, easeFactor: 1.3 };

    const next = scheduleReview({ previous: low, quality: 3 });

    expect(next.easeFactor).toBeGreaterThanOrEqual(1.3);
  });
});
