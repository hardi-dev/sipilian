import { describe, expect, it } from "vitest";

import { isErr, isOk } from "./result";
import { scoreObjectiveSubtest, scoreTkpSubtest } from "./scoring";

describe("scoreObjectiveSubtest", () => {
  it("awards 5 points per correct answer and marks a pass", () => {
    const result = scoreObjectiveSubtest({ kind: "twk", correctCount: 20, passingGrade: 65 });

    expect(isOk(result)).toBe(true);

    if (isOk(result)) {
      expect(result.value.rawScore).toBe(100);
      expect(result.value.passed).toBe(true);
      expect(result.value.kind).toBe("twk");
    }
  });

  it("marks a fail below the passing grade", () => {
    const result = scoreObjectiveSubtest({ kind: "tiu", correctCount: 10, passingGrade: 80 });

    expect(isOk(result)).toBe(true);

    if (isOk(result)) {
      expect(result.value.rawScore).toBe(50);
      expect(result.value.passed).toBe(false);
    }
  });

  it("rejects a negative correct count", () => {
    const result = scoreObjectiveSubtest({ kind: "twk", correctCount: -1, passingGrade: 65 });

    expect(isErr(result)).toBe(true);

    if (isErr(result)) {
      expect(result.error.code).toBe("negative_correct_count");
    }
  });
});

describe("scoreTkpSubtest", () => {
  it("sums the selected option weights (no wrong answers)", () => {
    const result = scoreTkpSubtest({ selectedWeights: [5, 4, 3, 5, 2], passingGrade: 15 });

    expect(isOk(result)).toBe(true);

    if (isOk(result)) {
      expect(result.value.rawScore).toBe(19);
      expect(result.value.kind).toBe("tkp");
      expect(result.value.passed).toBe(true);
    }
  });

  it("rejects a weight outside the 1..5 range", () => {
    const result = scoreTkpSubtest({ selectedWeights: [5, 6], passingGrade: 10 });

    expect(isErr(result)).toBe(true);

    if (isErr(result)) {
      expect(result.error.code).toBe("invalid_tkp_weight");
    }
  });
});
