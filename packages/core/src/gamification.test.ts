import { describe, expect, it } from "vitest";

import { calculateXp } from "./gamification";

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
