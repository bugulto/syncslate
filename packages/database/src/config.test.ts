import { describe, expect, it } from "vitest";

import { parseDatabaseConfig } from "./config.js";

describe("parseDatabaseConfig", () => {
  it("applies a safe local pool-size default", () => {
    expect(
      parseDatabaseConfig({
        connectionString:
          "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
      }),
    ).toEqual({
      connectionString:
        "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
      maxConnections: 10,
    });
  });

  it("accepts an explicit pool size", () => {
    expect(
      parseDatabaseConfig({
        connectionString:
          "postgres://postgres:postgres@localhost:5432/postgres",
        maxConnections: 4,
      }).maxConnections,
    ).toBe(4);
  });

  it("rejects missing or non-PostgreSQL URLs", () => {
    expect(() => parseDatabaseConfig({ connectionString: undefined })).toThrow(
      "Invalid database configuration",
    );
    expect(() =>
      parseDatabaseConfig({ connectionString: "https://example.com" }),
    ).toThrow("Must be a PostgreSQL connection URL");
  });
});
