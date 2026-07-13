import { describe, expect, it } from "vitest";

import { dbEnvSchema, FALLBACK_URL } from "./env";

describe("dbEnvSchema", () => {
  it("accepts a valid databaseUrl", () => {
    const result = dbEnvSchema.safeParse({ databaseUrl: "postgres://u:p@host/db" });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.databaseUrl).toBe("postgres://u:p@host/db");
    }
  });

  it("uses fallback for an empty databaseUrl", () => {
    const result = dbEnvSchema.safeParse({ databaseUrl: "" });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.databaseUrl).toBe(FALLBACK_URL);
    }
  });

  it("uses the fallback URL when databaseUrl is missing", () => {
    const result = dbEnvSchema.safeParse({});

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.databaseUrl).toBe(FALLBACK_URL);
    }
  });
});
