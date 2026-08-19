import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SignInPage from "./page";

const { createClient, getClaims, redirect } = vi.hoisted(() => ({
  createClient: vi.fn(),
  getClaims: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect,
  useRouter: () => ({
    refresh: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock("../../lib/supabase/server", () => ({
  createClient,
}));

describe("SignInPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClient.mockResolvedValue({ auth: { getClaims } });
    getClaims.mockResolvedValue({ data: { claims: undefined }, error: null });
  });

  it("renders the authentication form", async () => {
    render(await SignInPage({ searchParams: Promise.resolve({}) }));

    expect(
      screen.getByRole("heading", { name: "Sign in to SyncSlate" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(getClaims).toHaveBeenCalledOnce();
  });

  it("redirects an authenticated user to the dashboard", async () => {
    getClaims.mockResolvedValue({
      data: { claims: { sub: "user-id" } },
      error: null,
    });
    redirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(
      SignInPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });

  it("renders sign-in when the session check fails", async () => {
    createClient.mockRejectedValue(new Error("Supabase unavailable"));

    render(await SignInPage({ searchParams: Promise.resolve({}) }));

    expect(
      screen.getByRole("heading", { name: "Sign in to SyncSlate" }),
    ).toBeInTheDocument();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("shows a safe callback failure message", async () => {
    render(
      await SignInPage({
        searchParams: Promise.resolve({ error: "auth_callback_failed" }),
      }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Authentication could not be completed. Please try again.",
    );
  });

  it("does not display unknown query-string errors", async () => {
    render(
      await SignInPage({
        searchParams: Promise.resolve({ error: "sensitive-provider-error" }),
      }),
    );

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      screen.queryByText("sensitive-provider-error"),
    ).not.toBeInTheDocument();
  });
});
