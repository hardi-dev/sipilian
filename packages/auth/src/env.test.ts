import { describe, expect, it } from "vitest";

import { buildAuthEnv } from "./env";

const validSource = {
  BETTER_AUTH_SECRET: "x".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
  TRUSTED_ORIGINS: "http://localhost:3000, sipilian://",
};

describe("buildAuthEnv", () => {
  it("parses a valid source and splits trusted origins", () => {
    const env = buildAuthEnv(validSource);

    expect(env.secret).toHaveLength(32);
    expect(env.baseUrl).toBe("http://localhost:3000");
    expect(env.trustedOrigins).toEqual(["http://localhost:3000", "sipilian://"]);
  });

  it("throws when the secret is shorter than 32 chars", () => {
    expect(() => buildAuthEnv({ ...validSource, BETTER_AUTH_SECRET: "short" })).toThrow();
  });

  it("throws when baseUrl is not a URL", () => {
    expect(() => buildAuthEnv({ ...validSource, BETTER_AUTH_URL: "nope" })).toThrow();
  });

  it("throws when trustedOrigins is blank", () => {
    expect(() => buildAuthEnv({ ...validSource, TRUSTED_ORIGINS: "" })).toThrow();
  });
});
