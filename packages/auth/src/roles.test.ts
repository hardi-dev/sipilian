import { describe, expect, it } from "vitest";

import { isAdmin, requireAdmin, ROLES } from "./roles";

describe("isAdmin", () => {
  it("is true for an admin role", () => {
    expect(isAdmin({ role: ROLES.admin })).toBe(true);
  });

  it("is false for a user role", () => {
    expect(isAdmin({ role: ROLES.user })).toBe(false);
  });
});

describe("requireAdmin", () => {
  it("returns Ok for an admin", () => {
    const result = requireAdmin({ role: ROLES.admin });

    expect(result.ok).toBe(true);
  });

  it("returns Err(not_admin) for a non-admin", () => {
    const result = requireAdmin({ role: ROLES.user });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.code).toBe("not_admin");
    }
  });
});
