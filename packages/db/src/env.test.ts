import { describe, expect, it } from "vitest";

import { dbEnvSchema } from "./env";

describe("dbEnvSchema", () => {
  it("accepts a valid databaseUrl", () => {
    const result = dbEnvSchema.safeParse({ databaseUrl: "postgres://u:p@host/db" });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.databaseUrl).toBe("postgres://u:p@host/db");
    }
  });

  it("rejects an empty databaseUrl", () => {
    const result = dbEnvSchema.safeParse({ databaseUrl: "" });

    expect(result.success).toBe(false);
  });

  it("rejects a missing databaseUrl", () => {
    const result = dbEnvSchema.safeParse({});

    expect(result.success).toBe(false);
  });
});
