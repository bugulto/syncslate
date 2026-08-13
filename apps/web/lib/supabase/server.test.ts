import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createClient } from "./server";

const { cookieStore, serverClient } = vi.hoisted(() => ({
  cookieStore: {
    getAll: vi.fn(),
    set: vi.fn(),
  },
  serverClient: { kind: "server-client" },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStore),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => serverClient),
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
    throw new Error("Supabase server client was not created");
  }

  return options.cookies;
}

describe("server createClient", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:4000/api/v1");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321/");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
    cookieStore.getAll.mockReturnValue([
      { name: "supabase-session", value: "session-value" },
    ]);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("creates a server client with the request cookie store", async () => {
    await expect(createClient()).resolves.toBe(serverClient);

    expect(cookies).toHaveBeenCalledOnce();
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
  });

  it("writes refreshed cookies when the request context allows it", async () => {
    await createClient();

    getCookieAdapter().setAll(
      [
        {
          name: "supabase-session",
          value: "refreshed-value",
          options: { httpOnly: true },
        },
      ],
      {},
    );

    expect(cookieStore.set).toHaveBeenCalledWith(
      "supabase-session",
      "refreshed-value",
      { httpOnly: true },
    );
  });

  it("tolerates read-only Server Component cookie stores", async () => {
    cookieStore.set.mockImplementation(() => {
      throw new Error("Cookies can only be modified in a mutable context");
    });
    await createClient();

    expect(() =>
      getCookieAdapter().setAll(
        [
          {
            name: "supabase-session",
            value: "refreshed-value",
            options: {},
          },
        ],
        {},
      ),
    ).not.toThrow();
  });
});
