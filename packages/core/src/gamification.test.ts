import { describe, expect, it } from "vitest";

import { calculateXp, updateStreak } from "./gamification";

describe("calculateXp", () => {
  it("awards ten XP per correct answer", () => {
    expect(calculateXp({ correctCount: 6, questionCount: 10 })).toBe(60);
  });

  it("adds a perfect-lesson bonus", () => {
    expect(calculateXp({ correctCount: 10, questionCount: 10 })).toBe(120);
  });

  it("awards no bonus for an empty lesson", () => {
    expect(calculateXp({ correctCount: 0, questionCount: 0 })).toBe(0);
  });
});

describe("updateStreak", () => {
  const base = { currentStreak: 4, longestStreak: 9, lastActivityDate: "2026-07-10" };

  it("increments the streak on the very next day", () => {
    const next = updateStreak({ previous: base, activityDate: "2026-07-11" });

    expect(next.currentStreak).toBe(5);
    expect(next.longestStreak).toBe(9);
    expect(next.lastActivityDate).toBe("2026-07-11");
  });

  it("raises the longest streak when the current one overtakes it", () => {
    const nearRecord = { currentStreak: 9, longestStreak: 9, lastActivityDate: "2026-07-10" };

    const next = updateStreak({ previous: nearRecord, activityDate: "2026-07-11" });

    expect(next.currentStreak).toBe(10);
    expect(next.longestStreak).toBe(10);
  });

  it("leaves the streak unchanged for same-day activity", () => {
    const next = updateStreak({ previous: base, activityDate: "2026-07-10" });

    expect(next).toEqual(base);
  });

  it("resets to one after a missed day", () => {
    const next = updateStreak({ previous: base, activityDate: "2026-07-13" });

    expect(next.currentStreak).toBe(1);
    expect(next.longestStreak).toBe(9);
  });
});
