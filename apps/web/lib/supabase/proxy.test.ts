import { createServerClient } from "@supabase/ssr";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { updateSession } from "./proxy";

const { getClaims, supabaseClient } = vi.hoisted(() => {
  const claims = vi.fn();

  return {
    getClaims: claims,
    supabaseClient: { auth: { getClaims: claims } },
  };
});

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => supabaseClient),
}));

type CookieAdapter = {
  getAll: () => Array<{ name: string; value: string }>;
  setAll: (
    cookiesToSet: Array<{
      name: string;
      value: string;
      options: Record<string, unknown>;
    }>,
    headers: Record<string, string>,
  ) => void;
};

function getCookieAdapter(): CookieAdapter {
  const options = vi.mocked(createServerClient).mock
    .calls[0]?.[2] as unknown as { cookies: CookieAdapter } | undefined;

  if (!options) {
    throw new Error("Supabase proxy client was not created");
  }

  return options.cookies;
}

describe("updateSession", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:4000/api/v1");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321/");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
    getClaims.mockResolvedValue({ data: { claims: null }, error: null });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("validates the session using cookies from the incoming request", async () => {
    const request = new NextRequest("http://localhost:3000/dashboard", {
      headers: { cookie: "supabase-session=session-value" },
    });

    const response = await updateSession(request);

    expect(createServerClient).toHaveBeenCalledWith(
      "http://127.0.0.1:54321",
      "test-anon-key",
      {
        cookies: {
          getAll: expect.any(Function),
          setAll: expect.any(Function),
        },
      },
    );
    expect(getCookieAdapter().getAll()).toEqual([
      { name: "supabase-session", value: "session-value" },
    ]);
    expect(getClaims).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
  });

  it("propagates refreshed cookies and cache headers", async () => {
    const request = new NextRequest("http://localhost:3000/dashboard");
    getClaims.mockImplementation(async () => {
      getCookieAdapter().setAll(
        [
          {
            name: "supabase-session",
            value: "refreshed-value",
            options: { httpOnly: true, path: "/" },
          },
        ],
        {
          "cache-control": "private, no-store",
          pragma: "no-cache",
        },
      );

      return { data: { claims: { sub: "user-id" } }, error: null };
    });

    const response = await updateSession(request);

    expect(request.cookies.get("supabase-session")?.value).toBe(
      "refreshed-value",
    );
    expect(response.cookies.get("supabase-session")?.value).toBe(
      "refreshed-value",
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("pragma")).toBe("no-cache");
  });
});
