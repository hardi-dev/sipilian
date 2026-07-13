import { err, ok } from "@sipilian/core";
import { db } from "@sipilian/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { withIdempotency } from "./idempotency";
import type { SeededContent } from "./test-support";
import { cleanup, seedContent, testContext } from "./test-support";

let seeded: SeededContent;

beforeAll(async () => {
  seeded = await seedContent(db);
});

afterAll(async () => {
  await cleanup(db, seeded);
});

describe("withIdempotency", () => {
  it("runs fn once and replays the stored result on the same key", async () => {
    const ctx = testContext(db, seeded.userId);
    const key = `k-${Date.now().toString()}`;
    let calls = 0;

    const run = () =>
      withIdempotency(ctx, key, () => {
        calls += 1;

        return Promise.resolve(ok({ n: calls }));
      });

    const first = await run();
    const second = await run();

    expect(calls).toBe(1);
    expect(first).toEqual(second);
  });

  it("does not cache an Err result", async () => {
    const ctx = testContext(db, seeded.userId);
    const key = `k-err-${Date.now().toString()}`;
    let calls = 0;

    const run = () =>
      withIdempotency(ctx, key, () => {
        calls += 1;

        return Promise.resolve(err({ code: "x" }));
      });

    await run();
    await run();

    expect(calls).toBe(2);
  });
});
