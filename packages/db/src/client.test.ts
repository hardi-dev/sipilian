import { describe, expect, it, vi } from "vitest";

vi.mock("./env", () => {
  const mockEnv = { databaseUrl: "postgres://u:p@host/db" };

  return {
    get dbEnv() {
      return mockEnv;
    },
  };
});

import { type Db, db } from "./client";

describe("db client", () => {
  it("exposes a defined Drizzle instance", () => {
    expect(db).toBeDefined();
    expect(typeof db).toBe("object");
  });

  it("typed as NeonHttpDatabase via Db alias", () => {
    const ref: Db = db;

    expect(ref).toBe(db);
  });

  it("exports the same singleton on every import (module-level instance)", async () => {
    const fresh = await import("./client");

    expect(fresh.db).toBe(db);
  });
});
