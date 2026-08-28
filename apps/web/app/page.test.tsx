import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import HomePage from "./page";

const { createClient, getClaims } = vi.hoisted(() => ({
  createClient: vi.fn(),
  getClaims: vi.fn(),
}));

vi.mock("../lib/supabase/server", () => ({ createClient }));

describe("HomePage", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:4000/api/v1");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
    createClient.mockResolvedValue({ auth: { getClaims } });
    getClaims.mockResolvedValue({ data: { claims: undefined }, error: null });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("introduces the product and links anonymous visitors to sign in", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(new Promise(() => undefined)),
    );
    render(await HomePage());

    expect(
      screen.getByRole("heading", { level: 1, name: "SyncSlate" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Real-time technical interviews, in one focused workspace.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/sign-in",
    );
    expect(screen.getByRole("status")).toHaveTextContent("Checking API…");
  });

  it("links authenticated visitors to their dashboard", async () => {
    getClaims.mockResolvedValue({
      data: { claims: { sub: "user-id" } },
      error: null,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(new Promise(() => undefined)),
    );

    render(await HomePage());

    expect(
      screen.getByRole("link", { name: "Go to dashboard" }),
    ).toHaveAttribute("href", "/dashboard");
  });

  it("falls back to sign in when the session lookup fails", async () => {
    createClient.mockRejectedValue(new Error("Supabase unavailable"));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(new Promise(() => undefined)),
    );

    render(await HomePage());

    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/sign-in",
    );
  });

  it("shows when the API is connected", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ status: "ok" }),
      }),
    );

    render(await HomePage());

    expect(
      await screen.findByRole("status", { name: "API connected" }),
    ).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/health",
      expect.objectContaining({
        headers: { accept: "application/json" },
      }),
    );
  });

  it("shows when the API response is unavailable or invalid", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ status: "unexpected" }),
      }),
    );

    render(await HomePage());

    expect(
      await screen.findByRole("status", { name: "API unavailable" }),
    ).toBeInTheDocument();
  });
});
