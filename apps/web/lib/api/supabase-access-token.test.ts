import { describe, expect, it, vi } from "vitest";

import { getSupabaseAccessToken } from "./supabase-access-token";

describe("getSupabaseAccessToken", () => {
  it("returns the access token from a valid Supabase session", async () => {
    const getSession = vi.fn(async () => ({
      data: { session: { access_token: "verified-access-token" } },
      error: null,
    }));

    await expect(
      getSupabaseAccessToken({ auth: { getSession } }),
    ).resolves.toBe("verified-access-token");
    expect(getSession).toHaveBeenCalledOnce();
  });

  it("returns null when there is no session", async () => {
    const getSession = vi.fn(async () => ({
      data: { session: null },
      error: null,
    }));

    await expect(
      getSupabaseAccessToken({ auth: { getSession } }),
    ).resolves.toBeNull();
  });

  it("returns null when Supabase reports a session error", async () => {
    const getSession = vi.fn(async () => ({
      data: { session: null },
      error: new Error("sensitive session failure"),
    }));

    await expect(
      getSupabaseAccessToken({ auth: { getSession } }),
    ).resolves.toBeNull();
  });

  it.each([undefined, "", "   "])(
    "returns null for the unusable token %s",
    async (accessToken) => {
      const getSession = vi.fn(async () => ({
        data: { session: { access_token: accessToken } },
        error: null,
      }));

      await expect(
        getSupabaseAccessToken({ auth: { getSession } }),
      ).resolves.toBeNull();
    },
  );

  it("returns null when reading the session throws", async () => {
    const getSession = vi.fn(async () => {
      throw new Error("sensitive session exception");
    });

    await expect(
      getSupabaseAccessToken({ auth: { getSession } }),
    ).resolves.toBeNull();
  });
});
