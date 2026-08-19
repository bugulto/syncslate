import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import SignInPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    replace: vi.fn(),
  }),
}));

describe("SignInPage", () => {
  it("renders the authentication form", async () => {
    render(await SignInPage({ searchParams: Promise.resolve({}) }));

    expect(
      screen.getByRole("heading", { name: "Sign in to SyncSlate" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
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
