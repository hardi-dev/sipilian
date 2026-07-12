import { describe, expect, it } from "vitest";

import { SUBTEST_KINDS } from "./domain";

describe("domain", () => {
  it("lists the three SKD subtests in order", () => {
    expect(SUBTEST_KINDS).toEqual(["twk", "tiu", "tkp"]);
  });
});
