import { describe, expect, it } from "vitest";

import { accounts, sessions, users, verifications } from "./auth";

const drizzleName = Symbol.for("drizzle:Name");

function tableName(table: unknown): string {
  return (table as Record<symbol, string>)[drizzleName] ?? "";
}

describe("auth schema", () => {
  it("defines users table", () => {
    expect(tableName(users)).toBe("users");
  });

  it("defines sessions table", () => {
    expect(tableName(sessions)).toBe("sessions");
  });

  it("defines accounts table", () => {
    expect(tableName(accounts)).toBe("accounts");
  });

  it("defines verifications table", () => {
    expect(tableName(verifications)).toBe("verifications");
  });
});
