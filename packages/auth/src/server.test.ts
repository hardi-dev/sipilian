import { describe, expect, it } from "vitest";

import { auth } from "./server";

describe("auth server instance", () => {
  it("exposes the Better Auth handler and api", () => {
    expect(typeof auth.handler).toBe("function");
    expect(auth.api).toBeDefined();
  });
});
