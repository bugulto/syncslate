import { describe, expect, it } from "vitest";

import { parseApiEnv } from "./env.js";

describe("parseApiEnv", () => {
  it("provides safe local defaults", () => {
    expect(parseApiEnv({})).toEqual({
      NODE_ENV: "development",
      HOST: "0.0.0.0",
      PORT: 4000,
      LOG_LEVEL: "info",
    });
  });

  it("parses valid environment strings", () => {
    expect(
      parseApiEnv({
        NODE_ENV: "production",
        HOST: "127.0.0.1",
        PORT: "8080",
        LOG_LEVEL: "warn",
      }),
    ).toEqual({
      NODE_ENV: "production",
      HOST: "127.0.0.1",
      PORT: 8080,
      LOG_LEVEL: "warn",
    });
  });

  it("rejects invalid values", () => {
    expect(() => parseApiEnv({ PORT: "70000" })).toThrow(
      "Invalid API environment",
    );
  });
});
