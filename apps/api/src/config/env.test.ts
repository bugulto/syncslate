import { describe, expect, it } from "vitest";

import { parseApiEnv } from "./env.js";

const validSupabaseEnv = {
  SUPABASE_URL: "http://127.0.0.1:54321",
  SUPABASE_ANON_KEY: "test-anon-key",
  INVITE_TOKEN_PEPPER: "test-invitation-token-pepper-12345",
  GUEST_JWT_SECRET: "test-guest-jwt-secret-at-least-32-characters",
};

describe("parseApiEnv", () => {
  it("provides safe local defaults", () => {
    expect(
      parseApiEnv({
        DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
        ...validSupabaseEnv,
      }),
    ).toEqual({
      NODE_ENV: "development",
      HOST: "0.0.0.0",
      PORT: 4000,
      LOG_LEVEL: "info",
      CORS_ALLOWED_ORIGINS: ["http://localhost:3000"],
      DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
      GUEST_JWT_TTL_SECONDS: 1_800,
      ...validSupabaseEnv,
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
        SUPABASE_URL: "https://project.supabase.co/",
        SUPABASE_ANON_KEY: "production-anon-key",
        INVITE_TOKEN_PEPPER: "production-invitation-token-pepper",
        GUEST_JWT_SECRET: "production-guest-token-secret-123456789",
        GUEST_JWT_TTL_SECONDS: "900",
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
      SUPABASE_URL: "https://project.supabase.co",
      SUPABASE_ANON_KEY: "production-anon-key",
      INVITE_TOKEN_PEPPER: "production-invitation-token-pepper",
      GUEST_JWT_SECRET: "production-guest-token-secret-123456789",
      GUEST_JWT_TTL_SECONDS: 900,
    });
  });

  it("rejects invalid values", () => {
    expect(() =>
      parseApiEnv({
        PORT: "70000",
        DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
        ...validSupabaseEnv,
      }),
    ).toThrow("Invalid API environment");
    expect(() =>
      parseApiEnv({
        DATABASE_URL: "https://example.com",
        ...validSupabaseEnv,
      }),
    ).toThrow("Must be a PostgreSQL connection URL");
    expect(() =>
      parseApiEnv({
        CORS_ALLOWED_ORIGINS: "not-a-url",
        DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
        ...validSupabaseEnv,
      }),
    ).toThrow("Invalid API environment");
  });

  it("rejects missing or invalid Supabase configuration", () => {
    const databaseEnv = {
      DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
      INVITE_TOKEN_PEPPER: validSupabaseEnv.INVITE_TOKEN_PEPPER,
      GUEST_JWT_SECRET: validSupabaseEnv.GUEST_JWT_SECRET,
    };

    expect(() => parseApiEnv(databaseEnv)).toThrow("Invalid API environment");
    expect(() =>
      parseApiEnv({
        ...databaseEnv,
        SUPABASE_URL: "not-a-url",
        SUPABASE_ANON_KEY: "test-anon-key",
      }),
    ).toThrow("Invalid API environment");
    expect(() =>
      parseApiEnv({
        ...databaseEnv,
        SUPABASE_URL: "http://127.0.0.1:54321",
        SUPABASE_ANON_KEY: "   ",
      }),
    ).toThrow("Invalid API environment");
  });

  it("rejects a missing or weak invitation token pepper", () => {
    const baseEnv = {
      DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
      SUPABASE_URL: "http://127.0.0.1:54321",
      SUPABASE_ANON_KEY: "test-anon-key",
    };

    expect(() => parseApiEnv(baseEnv)).toThrow("Invalid API environment");
    expect(() =>
      parseApiEnv({
        ...baseEnv,
        INVITE_TOKEN_PEPPER: "too-short",
      }),
    ).toThrow("Must contain at least 32 characters");
  });

  it("rejects missing or weak guest-token configuration", () => {
    const databaseEnv = {
      DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
      SUPABASE_URL: validSupabaseEnv.SUPABASE_URL,
      SUPABASE_ANON_KEY: validSupabaseEnv.SUPABASE_ANON_KEY,
      INVITE_TOKEN_PEPPER: validSupabaseEnv.INVITE_TOKEN_PEPPER,
    };

    expect(() => parseApiEnv(databaseEnv)).toThrow("Invalid API environment");
    expect(() =>
      parseApiEnv({ ...databaseEnv, GUEST_JWT_SECRET: "too-short" }),
    ).toThrow("Must contain at least 32 characters");
    expect(() =>
      parseApiEnv({
        ...databaseEnv,
        GUEST_JWT_SECRET: validSupabaseEnv.GUEST_JWT_SECRET,
        GUEST_JWT_TTL_SECONDS: "60",
      }),
    ).toThrow("Invalid API environment");
    expect(() =>
      parseApiEnv({
        ...databaseEnv,
        GUEST_JWT_SECRET: databaseEnv.INVITE_TOKEN_PEPPER,
      }),
    ).toThrow("Must differ from INVITE_TOKEN_PEPPER");
  });
});
