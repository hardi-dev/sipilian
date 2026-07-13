import { randomUUID } from "node:crypto";

import { db } from "@sipilian/db";
import {
  questionOptions,
  questions,
  subtests,
  topics,
  tryoutPackageQuestions,
  tryoutPackages,
  users,
} from "@sipilian/db/schema";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { RequestContext } from "../context";
import { testContext } from "../test-support";
import { startTryout, submitTryout } from "./tryouts.handler";

interface TryoutSeed {
  readonly userId: string;
  readonly subtestId: string;
  readonly packageId: string;
  readonly questionIds: readonly string[];
  readonly correctOptionIds: readonly string[];
  attemptId: string | undefined;
}

async function seedTryoutContent(): Promise<TryoutSeed> {
  const tag = randomUUID().replace(/-/g, "").slice(0, 12);

  const [user] = await db
    .insert(users)
    .values({
      id: sql`gen_random_uuid()`,
      name: "Tryout Test",
      email: `tryout-${tag}@example.com`,
    })
    .returning();

  const userId = user!.id;

  const sTag = randomUUID().replace(/-/g, "").slice(0, 8);

  const [subtest] = await db
    .insert(subtests)
    .values({ slug: `twk-${sTag}`, name: "TWK", passingGrade: 0 })
    .returning();

  const subtestId = subtest!.id;

  const [topic] = await db
    .insert(topics)
    .values({ subtestId, slug: "nasionalisme", name: "Nasionalisme" })
    .returning();

  const questionIds: string[] = [];
  const correctOptionIds: string[] = [];

  for (let i = 0; i < 2; i++) {
    const [q] = await db
      .insert(questions)
      .values({
        topicId: topic!.id,
        type: "multiple_choice",
        status: "published",
        difficulty: 1,
        stem: `Q${String(i)}`,
      })
      .returning();

    const questionId = q!.id;

    const [right] = await db
      .insert(questionOptions)
      .values({ questionId, label: "A", text: "right", isCorrect: true, order: 1 })
      .returning();

    await db
      .insert(questionOptions)
      .values({ questionId, label: "B", text: "wrong", isCorrect: false, order: 2 });

    questionIds.push(questionId);
    correctOptionIds.push(right!.id);
  }

  const pTag = randomUUID().replace(/-/g, "").slice(0, 8);

  const [pkg] = await db
    .insert(tryoutPackages)
    .values({
      slug: `skd-${pTag}`,
      name: "Tryout",
      durationMinutes: 100,
      composition: { twk: 2, tiu: 0, tkp: 0 },
    })
    .returning();

  const packageId = pkg!.id;

  for (let i = 0; i < questionIds.length; i++) {
    await db
      .insert(tryoutPackageQuestions)
      .values({ packageId, questionId: questionIds[i]!, order: i + 1 });
  }

  return { userId, subtestId, packageId, questionIds, correctOptionIds, attemptId: undefined };
}

async function cleanupTryoutContent(seed: TryoutSeed): Promise<void> {
  await db.delete(users).where(eq(users.id, seed.userId));
  await db.delete(subtests).where(eq(subtests.id, seed.subtestId));
  await db.delete(tryoutPackages).where(eq(tryoutPackages.id, seed.packageId));
}

let ctx: RequestContext;
let seeded: TryoutSeed;

beforeAll(async () => {
  seeded = await seedTryoutContent();
  ctx = testContext(db, seeded.userId);
});

afterAll(async () => {
  await cleanupTryoutContent(seeded);
});

describe("startTryout", () => {
  it("returns the attempt id for a valid package", async () => {
    const result = await startTryout({ packageId: seeded.packageId }, ctx);

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.value.attemptId).toBeDefined();
    }

    seeded.attemptId = result.ok ? result.value.attemptId : undefined;
  });
});

describe("submitTryout", () => {
  beforeAll(async () => {
    if (!seeded.attemptId) {
      const result = await startTryout({ packageId: seeded.packageId }, ctx);

      if (result.ok) {
        seeded.attemptId = result.value.attemptId;
      }
    }
  });

  it("scores correct answers and returns the tryout result", async () => {
    const answers = seeded.questionIds.map((qId, i) => ({
      questionId: qId,
      optionId: seeded.correctOptionIds[i]!,
      weight: undefined,
    }));

    const result = await submitTryout(
      { attemptId: seeded.attemptId!, answers, idempotencyKey: "ik-tryout-1" },
      ctx,
    );

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.value.subtests).toHaveLength(1);
      expect(result.value.subtests[0]?.kind).toBe("twk");
      expect(result.value.subtests[0]?.rawScore).toBe(10);
      expect(result.value.subtests[0]?.passed).toBe(true);
      expect(result.value.totalScore).toBe(10);
      expect(result.value.passedAll).toBe(true);
    }
  });

  it("returns not_found for a missing attempt", async () => {
    const result = await submitTryout(
      {
        attemptId: "00000000-0000-0000-0000-000000000000",
        answers: [{ questionId: seeded.questionIds[0]!, optionId: seeded.correctOptionIds[0]! }],
        idempotencyKey: "ik-nonexistent",
      },
      ctx,
    );

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.code).toBe("not_found");
    }
  });

  it("replays idempotently with the same key", async () => {
    const answers = seeded.questionIds.map((qId, i) => ({
      questionId: qId,
      optionId: seeded.correctOptionIds[i]!,
      weight: undefined,
    }));

    const result1 = await submitTryout(
      { attemptId: seeded.attemptId!, answers, idempotencyKey: "ik-tryout-dupe" },
      ctx,
    );

    const result2 = await submitTryout(
      { attemptId: seeded.attemptId!, answers, idempotencyKey: "ik-tryout-dupe" },
      ctx,
    );

    expect(result1.ok).toBe(true);
    expect(result2.ok).toBe(true);

    if (result1.ok && result2.ok) {
      expect(result2.value).toEqual(result1.value);
    }
  });
});
