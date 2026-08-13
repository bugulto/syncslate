import { describe, expect, it } from "vitest";

import { parseWebEnv } from "./env";

describe("parseWebEnv", () => {
  it("accepts public URLs and removes trailing slashes", () => {
    expect(
      parseWebEnv({
        NEXT_PUBLIC_API_URL: "http://localhost:4000/api/v1/",
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321/",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
      }),
    ).toEqual({
      NEXT_PUBLIC_API_URL: "http://localhost:4000/api/v1",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
    });
  });

  it("rejects missing or invalid configuration", () => {
    expect(() => parseWebEnv({})).toThrow("Invalid web environment");
    expect(() =>
      parseWebEnv({
        NEXT_PUBLIC_API_URL: "not-a-url",
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
      }),
    ).toThrow("Invalid web environment");
    expect(() =>
      parseWebEnv({
        NEXT_PUBLIC_API_URL: "http://localhost:4000/api/v1",
        NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
      }),
    ).toThrow("Invalid web environment");
    expect(() =>
      parseWebEnv({
        NEXT_PUBLIC_API_URL: "http://localhost:4000/api/v1",
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "   ",
      }),
    ).toThrow("Invalid web environment");
  });
});
