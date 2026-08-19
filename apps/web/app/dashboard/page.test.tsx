import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DashboardPage from "./page";

const { createClient, getClaims, redirect } = vi.hoisted(() => ({
  createClient: vi.fn(),
  getClaims: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect }));

vi.mock("../../lib/supabase/server", () => ({ createClient }));

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClient.mockResolvedValue({ auth: { getClaims } });
    getClaims.mockResolvedValue({
      data: { claims: { sub: "user-id" } },
      error: null,
    });
    redirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
  });

  it("renders the dashboard for an authenticated user", async () => {
    render(await DashboardPage());

    expect(
      screen.getByRole("heading", { level: 1, name: "Dashboard" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "No interview sessions yet" }),
    ).toBeInTheDocument();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("redirects an anonymous user to sign in", async () => {
    getClaims.mockResolvedValue({
      data: { claims: undefined },
      error: null,
    });

    await expect(DashboardPage()).rejects.toThrow("NEXT_REDIRECT");

    expect(redirect).toHaveBeenCalledWith("/sign-in");
  });

  it("redirects when session verification fails", async () => {
    createClient.mockRejectedValue(new Error("Supabase unavailable"));

    await expect(DashboardPage()).rejects.toThrow("NEXT_REDIRECT");

    expect(redirect).toHaveBeenCalledWith("/sign-in");
  });
});
