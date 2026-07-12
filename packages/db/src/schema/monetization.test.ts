import { describe, expect, it } from "vitest";

import { entitlementPlanEnum, entitlements } from "./monetization";

const drizzleName = Symbol.for("drizzle:Name");

function tableName(table: unknown): string {
  return (table as Record<symbol, string>)[drizzleName] ?? "";
}

describe("monetization schema", () => {
  it("defines entitlements table", () => {
    expect(tableName(entitlements)).toBe("entitlements");
  });

  it("declares free/premium plan enum", () => {
    expect(entitlementPlanEnum.enumValues).toEqual(["free", "premium"]);
  });
});
