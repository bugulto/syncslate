import { describe, expect, it } from "vitest";

import { extractBearerToken } from "./bearer-token.js";

describe("extractBearerToken", () => {
  it("extracts a bearer token", () => {
    expect(extractBearerToken("Bearer header.payload.signature")).toBe(
      "header.payload.signature",
    );
  });

  it("accepts a case-insensitive bearer scheme", () => {
    expect(extractBearerToken("bearer access-token")).toBe("access-token");
  });

  it.each([
    undefined,
    "",
    "Basic credentials",
    "Bearer",
    "Bearer ",
    "Bearer first second",
    "Bearer first, Bearer second",
    ["Bearer first", "Bearer second"],
  ])("rejects a missing or malformed authorization header: %j", (header) => {
    expect(extractBearerToken(header)).toBeNull();
  });
});
