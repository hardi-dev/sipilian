import { describe, expect, it } from "vitest";

import { apiError, toHttp } from "./http";

describe("apiError + toHttp", () => {
  it("assigns 404 to not_found and echoes code/message", () => {
    const error = apiError("not_found", "Lesson not found");

    expect(error.httpStatus).toBe(404);
    expect(toHttp(error)).toEqual({
      status: 404,
      body: { code: "not_found", message: "Lesson not found" },
    });
  });

  it("assigns 422 to validation_failed and unprocessable", () => {
    expect(apiError("validation_failed", "x").httpStatus).toBe(422);
    expect(apiError("unprocessable", "y").httpStatus).toBe(422);
  });

  it("assigns 403 to forbidden and 409 to conflict", () => {
    expect(apiError("forbidden", "x").httpStatus).toBe(403);
    expect(apiError("conflict", "y").httpStatus).toBe(409);
  });
});
