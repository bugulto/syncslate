import { describe, expect, it } from "vitest";

import { parseApiEnv } from "./env.js";

describe("parseApiEnv", () => {
  it("provides safe local defaults", () => {
    expect(
      parseApiEnv({
        DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
      }),
    ).toEqual({
      NODE_ENV: "development",
      HOST: "0.0.0.0",
      PORT: 4000,
      LOG_LEVEL: "info",
      CORS_ALLOWED_ORIGINS: ["http://localhost:3000"],
      DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    });
  });

  it("parses valid environment strings", () => {
    expect(
      parseApiEnv({
        NODE_ENV: "production",
        HOST: "127.0.0.1",
        PORT: "8080",
        LOG_LEVEL: "warn",
        CORS_ALLOWED_ORIGINS:
          "https://syncslate.example.com, https://preview.syncslate.example.com",
        DATABASE_URL: "postgres://user:password@database.example.com/app",
      }),
    ).toEqual({
      NODE_ENV: "production",
      HOST: "127.0.0.1",
      PORT: 8080,
      LOG_LEVEL: "warn",
      CORS_ALLOWED_ORIGINS: [
        "https://syncslate.example.com",
        "https://preview.syncslate.example.com",
      ],
      DATABASE_URL: "postgres://user:password@database.example.com/app",
    });
  });

  it("rejects invalid values", () => {
    expect(() =>
      parseApiEnv({
        PORT: "70000",
        DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
      }),
    ).toThrow("Invalid API environment");
    expect(() => parseApiEnv({ DATABASE_URL: "https://example.com" })).toThrow(
      "Must be a PostgreSQL connection URL",
    );
    expect(() =>
      parseApiEnv({
        CORS_ALLOWED_ORIGINS: "not-a-url",
        DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
      }),
    ).toThrow("Invalid API environment");
  });
});
