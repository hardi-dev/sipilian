import { describe, expect, it } from "vitest";

import { requestIdempotency } from "./idempotency";

describe("request_idempotency schema", () => {
  it("has user_id, key and jsonb response columns", () => {
    expect(requestIdempotency.userId.name).toBe("user_id");
    expect(requestIdempotency.key.name).toBe("key");
    expect(requestIdempotency.response.name).toBe("response");
  });
});
