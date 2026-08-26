import { z } from "zod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createClient as createSupabaseClient } from "../supabase/server";
import { createServerApiClient } from "./server";

const { getSession, supabaseClient } = vi.hoisted(() => {
  const getSession = vi.fn();

  return {
    getSession,
    supabaseClient: { auth: { getSession } },
  };
});

vi.mock("../supabase/server", () => ({
  createClient: vi.fn(async () => supabaseClient),
}));

function createResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: vi.fn(async () => body),
  } as unknown as Response;
}

describe("createServerApiClient", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:4000/api/v1/");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
    getSession.mockResolvedValue({
      data: { session: { access_token: "server-access-token" } },
      error: null,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses the request-scoped Supabase session for API requests", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(createResponse({ status: "ok" }));
    vi.stubGlobal("fetch", fetch);
    const client = await createServerApiClient();

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
    expect(headers.get("authorization")).toBe("Bearer server-access-token");
  });

  it("validates the public API environment before creating clients", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "not-a-url");
    vi.stubGlobal("fetch", vi.fn());

    await expect(createServerApiClient()).rejects.toThrow(
      "Invalid web environment",
    );
    expect(createSupabaseClient).not.toHaveBeenCalled();
  });
});
