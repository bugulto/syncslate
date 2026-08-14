import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createClient } from "../../../lib/supabase/server";
import { GET } from "./route";

const { exchangeCodeForSession, supabaseClient } = vi.hoisted(() => {
  const exchangeCode = vi.fn();

  return {
    exchangeCodeForSession: exchangeCode,
    supabaseClient: {
      auth: { exchangeCodeForSession: exchangeCode },
    },
  };
});

vi.mock("../../../lib/supabase/server", () => ({
  createClient: vi.fn(async () => supabaseClient),
}));

describe("GET /auth/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    exchangeCodeForSession.mockResolvedValue({ error: null });
  });

  it("exchanges the code and redirects to a safe internal destination", async () => {
    const request = new NextRequest(
      "http://localhost:3000/auth/callback?code=valid-code&next=%2Fdashboard%3Ftab%3Dprofile",
    );

    const response = await GET(request);

    expect(createClient).toHaveBeenCalledOnce();
    expect(exchangeCodeForSession).toHaveBeenCalledWith("valid-code");
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/dashboard?tab=profile",
    );
  });

  it.each([
    "https://attacker.example/steal-session",
    "//attacker.example/steal-session",
    "/\\attacker.example/steal-session",
  ])("rejects an unsafe next destination: %s", async (next) => {
    const request = new NextRequest(
      `http://localhost:3000/auth/callback?code=valid-code&next=${encodeURIComponent(next)}`,
    );

    const response = await GET(request);

    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/dashboard",
    );
  });

  it("redirects missing codes to a safe error without preserving parameters", async () => {
    const request = new NextRequest(
      "http://localhost:3000/auth/callback?next=%2Fdashboard",
    );

    const response = await GET(request);

    expect(createClient).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/sign-in?error=auth_callback_failed",
    );
  });

  it("redirects failed exchanges without exposing the authorization code", async () => {
    exchangeCodeForSession.mockResolvedValue({
      error: new Error("Code exchange failed"),
    });
    const request = new NextRequest(
      "http://localhost:3000/auth/callback?code=secret-code",
    );

    const response = await GET(request);
    const location = response.headers.get("location");

    expect(location).toBe(
      "http://localhost:3000/sign-in?error=auth_callback_failed",
    );
    expect(location).not.toContain("secret-code");
  });
});
