import { db } from "@sipilian/db";
import { entitlements } from "@sipilian/db/schema";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { SeededContent } from "../test-support";
import { cleanup, seedContent, testContext } from "../test-support";
import { setEntitlement } from "./entitlements.handler";

let seeded: SeededContent;

beforeAll(async () => {
  seeded = await seedContent(db);
});

afterAll(async () => {
  await cleanup(db, seeded);
});

describe("setEntitlement", () => {
  it("creates a new entitlement row with the given plan", async () => {
    const ctx = testContext(db, seeded.userId);

    const result = await setEntitlement(
      { userId: seeded.userId, plan: "premium", expiresAt: null },
      ctx,
    );

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.value.userId).toBe(seeded.userId);
      expect(result.value.plan).toBe("premium");
    }
  });

  it("accepts an optional expiresAt date", async () => {
    const ctx = testContext(db, seeded.userId);
    const expiresAt = new Date("2027-01-01T00:00:00.000Z");

    const result = await setEntitlement({ userId: seeded.userId, plan: "premium", expiresAt }, ctx);

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.value.plan).toBe("premium");
    }
  });

  it("upserts the plan and produces only one row when called again for the same user", async () => {
    const ctx = testContext(db, seeded.userId);

    const result1 = await setEntitlement(
      { userId: seeded.userId, plan: "free", expiresAt: null },
      ctx,
    );

    expect(result1.ok).toBe(true);

    if (result1.ok) {
      expect(result1.value.plan).toBe("free");
    }

    const result2 = await setEntitlement(
      { userId: seeded.userId, plan: "premium", expiresAt: null },
      ctx,
    );

    expect(result2.ok).toBe(true);

    if (result2.ok) {
      expect(result2.value.plan).toBe("premium");
    }

    const rows = await ctx.db
      .select()
      .from(entitlements)
      .where(eq(entitlements.userId, seeded.userId));

    expect(rows).toHaveLength(1);
  });
});
