import { db } from "@sipilian/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { SeededContent } from "../test-support";
import { cleanup, seedContent, testContext } from "../test-support";
import { getLearningPath, getLesson } from "./content.handler";

let seeded: SeededContent;

beforeAll(async () => {
  seeded = await seedContent(db);
});

afterAll(async () => {
  await cleanup(db, seeded);
});

describe("getLearningPath", () => {
  it("returns units and lessons for the subtest", async () => {
    const ctx = testContext(db, seeded.userId);
    const result = await getLearningPath({ subtestKind: "twk" }, ctx);

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.value.lessons.map((l) => l.id)).toContain(seeded.lessonId);
    }
  });

  it("returns not_found for an unseeded subtest kind with no rows", async () => {
    const ctx = testContext(db, seeded.userId);
    const result = await getLearningPath({ subtestKind: "tiu" }, ctx);

    expect(result.ok).toBe(false);
  });
});

describe("getLesson", () => {
  it("returns the lesson with its questions and options", async () => {
    const ctx = testContext(db, seeded.userId);
    const result = await getLesson({ lessonId: seeded.lessonId }, ctx);

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.value.questions).toHaveLength(2);
      expect(result.value.questions[0]?.options.length).toBeGreaterThan(0);
    }
  });

  it("returns not_found for a non-existent lesson", async () => {
    const ctx = testContext(db, seeded.userId);
    const result = await getLesson({ lessonId: "00000000-0000-0000-0000-000000000000" }, ctx);

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.code).toBe("not_found");
    }
  });
});
