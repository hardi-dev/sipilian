import { describe, expect, it } from "vitest";

import { err, isErr, isOk, ok } from "./result";

describe("result", () => {
  it("wraps a success value", () => {
    const result = ok(42);

    expect(result).toEqual({ ok: true, value: 42 });
  });

  it("wraps an error value", () => {
    const result = err("boom");

    expect(result).toEqual({ ok: false, error: "boom" });
  });

  it("narrows with isOk", () => {
    const result = ok(1);

    expect(isOk(result)).toBe(true);
    expect(isErr(result)).toBe(false);
  });

  it("narrows with isErr", () => {
    const result = err("bad");

    expect(isErr(result)).toBe(true);
    expect(isOk(result)).toBe(false);
  });
});
