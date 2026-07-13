import { db } from "@sipilian/db";
import { userQuestionStates } from "@sipilian/db/schema";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { SeededContent } from "../test-support";
import { cleanup, seedContent, testContext } from "../test-support";
import { syncProgress } from "./progress.handler";

let seeded: SeededContent;

beforeAll(async () => {
  seeded = await seedContent(db);
});

afterAll(async () => {
  await cleanup(db, seeded);
});

describe("syncProgress", () => {
  it("creates review states for new questions", async () => {
    const ctx = testContext(db, seeded.userId);
    const questions = seeded.questionIds.map((qId) => ({
      questionId: qId,
      quality: 4,
    }));

    const result = await syncProgress({ items: questions }, ctx);

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.value.synced).toBe(2);
    }
  });

  it("updates existing review states on subsequent sync", async () => {
    const ctx = testContext(db, seeded.userId);
    const questionId = seeded.questionIds[0]!;

    const result1 = await syncProgress({ items: [{ questionId, quality: 4 }] }, ctx);

    expect(result1.ok).toBe(true);

    if (result1.ok) {
      expect(result1.value.synced).toBe(1);
    }

    const result2 = await syncProgress({ items: [{ questionId, quality: 5 }] }, ctx);

    expect(result2.ok).toBe(true);

    if (result2.ok) {
      expect(result2.value.synced).toBe(1);
    }

    const rows = await ctx.db
      .select()
      .from(userQuestionStates)
      .where(
        and(
          eq(userQuestionStates.userId, seeded.userId),
          eq(userQuestionStates.questionId, questionId),
        ),
      );

    expect(rows).toHaveLength(1);
  });
});
