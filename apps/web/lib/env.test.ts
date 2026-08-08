import { describe, expect, it } from "vitest";

import { parseWebEnv } from "./env";

describe("parseWebEnv", () => {
  it("accepts the API URL and removes trailing slashes", () => {
    expect(
      parseWebEnv({
        NEXT_PUBLIC_API_URL: "http://localhost:4000/api/v1/",
      }),
    ).toEqual({
      NEXT_PUBLIC_API_URL: "http://localhost:4000/api/v1",
    });
  });

  it("rejects a missing or invalid API URL", () => {
    expect(() => parseWebEnv({})).toThrow("Invalid web environment");
    expect(() => parseWebEnv({ NEXT_PUBLIC_API_URL: "not-a-url" })).toThrow(
      "Invalid web environment",
    );
  });
});
