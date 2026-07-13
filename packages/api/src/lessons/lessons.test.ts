import { db } from "@sipilian/db";
import { questionOptions } from "@sipilian/db/schema";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { SeededContent } from "../test-support";
import { cleanup, seedContent, testContext } from "../test-support";
import { submitLesson } from "./lessons.handler";

let seeded: SeededContent;

beforeAll(async () => {
  seeded = await seedContent(db);
});

afterAll(async () => {
  await cleanup(db, seeded);
});

describe("submitLesson", () => {
  it("scores correct answers, awards XP, and advances streak", async () => {
    const ctx = testContext(db, seeded.userId);
    const answers = seeded.questionIds.map((qId) => ({
      questionId: qId,
      optionId: seeded.correctOptionByQuestion[qId]!,
    }));

    const result = await submitLesson(
      { lessonId: seeded.lessonId, answers, idempotencyKey: "ik-1" },
      ctx,
    );

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.value.correctCount).toBe(2);
      expect(result.value.xpEarned).toBe(40);
      expect(result.value.currentStreak).toBe(1);
    }
  });

  it("replays idempotently with the same key", async () => {
    const ctx = testContext(db, seeded.userId);
    const answers = seeded.questionIds.map((qId) => ({
      questionId: qId,
      optionId: seeded.correctOptionByQuestion[qId]!,
    }));

    const result1 = await submitLesson(
      { lessonId: seeded.lessonId, answers, idempotencyKey: "ik-dupe" },
      ctx,
    );

    const result2 = await submitLesson(
      { lessonId: seeded.lessonId, answers, idempotencyKey: "ik-dupe" },
      ctx,
    );

    expect(result1.ok).toBe(true);
    expect(result2.ok).toBe(true);

    if (result1.ok && result2.ok) {
      expect(result2.value).toEqual(result1.value);
    }
  });

  it("handles wrong answers with zero quality and lower XP", async () => {
    const ctx = testContext(db, seeded.userId);
    const wrongOptions = await Promise.all(
      seeded.questionIds.map(async (qId) => {
        const [opt] = await db
          .select({ id: questionOptions.id })
          .from(questionOptions)
          .where(and(eq(questionOptions.questionId, qId), eq(questionOptions.isCorrect, false)));

        return opt!;
      }),
    );
    const answers = wrongOptions.map((opt) => ({
      questionId: seeded.questionIds[0]!,
      optionId: opt.id,
    }));

    const result = await submitLesson(
      { lessonId: seeded.lessonId, answers, idempotencyKey: "ik-wrong" },
      ctx,
    );

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.value.correctCount).toBe(0);
      expect(result.value.xpEarned).toBe(0);
    }
  });
});
