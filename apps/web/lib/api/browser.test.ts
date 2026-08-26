import { z } from "zod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createClient as createSupabaseClient } from "../supabase/client";
import { createBrowserApiClient } from "./browser";

const { getSession, supabaseClient } = vi.hoisted(() => {
  const getSession = vi.fn();

  return {
    getSession,
    supabaseClient: { auth: { getSession } },
  };
});

vi.mock("../supabase/client", () => ({
  createClient: vi.fn(() => supabaseClient),
}));

function createResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: vi.fn(async () => body),
  } as unknown as Response;
}

describe("createBrowserApiClient", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:4000/api/v1/");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
    getSession.mockResolvedValue({
      data: { session: { access_token: "browser-access-token" } },
      error: null,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses the browser Supabase session for authenticated API requests", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(createResponse({ status: "ok" }));
    vi.stubGlobal("fetch", fetch);
    const client = createBrowserApiClient();

    await expect(
      client.request("/me", z.object({ status: z.literal("ok") })),
    ).resolves.toEqual({ status: "ok" });

    expect(createSupabaseClient).toHaveBeenCalledWith({
      NEXT_PUBLIC_API_URL: "http://localhost:4000/api/v1",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
    });
    expect(getSession).toHaveBeenCalledOnce();
    const [url, init] = fetch.mock.calls[0] ?? [];
    const headers = new Headers(init?.headers);

    expect(url).toBe("http://localhost:4000/api/v1/me");
    expect(headers.get("authorization")).toBe("Bearer browser-access-token");
  });

  it("validates the public API environment before creating clients", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "not-a-url");
    vi.stubGlobal("fetch", vi.fn());

    expect(() => createBrowserApiClient()).toThrow("Invalid web environment");
    expect(createSupabaseClient).not.toHaveBeenCalled();
  });
});
