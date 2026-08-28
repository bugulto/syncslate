import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthenticationRequiredError } from "../../lib/api/errors";
import DashboardPage from "./page";

const { apiClient, createServerApiClient, getCurrentUser, redirect } =
  vi.hoisted(() => ({
    apiClient: { request: vi.fn() },
    createServerApiClient: vi.fn(),
    getCurrentUser: vi.fn(),
    redirect: vi.fn(),
  }));

vi.mock("next/navigation", () => ({ redirect }));

vi.mock("../../lib/api/current-user", () => ({ getCurrentUser }));

vi.mock("../../lib/api/server", () => ({ createServerApiClient }));

vi.mock("../../features/auth/sign-out-button", () => ({
  SignOutButton: () => <button type="button">Sign out</button>,
}));

const currentUser = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "interviewer@example.com",
  displayName: "Ada Interviewer",
  avatarUrl: null,
};

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createServerApiClient.mockResolvedValue(apiClient);
    getCurrentUser.mockResolvedValue(currentUser);
    redirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
  });

  it("loads the current user and renders the authenticated dashboard", async () => {
    render(await DashboardPage());

    expect(createServerApiClient).toHaveBeenCalledOnce();
    expect(getCurrentUser).toHaveBeenCalledWith(apiClient);
    expect(
      screen.getByRole("heading", { level: 1, name: "Dashboard" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Ada Interviewer")).toBeInTheDocument();
    expect(screen.getByText("interviewer@example.com")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Ada Interviewer's initials" }),
    ).toHaveTextContent("AI");
    expect(
      screen.getByRole("button", { name: "Sign out" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Interviews" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "No interviews yet" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Your upcoming and completed interviews will appear here.",
      ),
    ).toBeInTheDocument();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("renders a profile avatar and handles a missing email", async () => {
    getCurrentUser.mockResolvedValue({
      ...currentUser,
      email: null,
      avatarUrl: "https://example.com/avatar.png",
    });

    render(await DashboardPage());

    expect(
      screen.getByRole("img", { name: "Ada Interviewer's avatar" }),
    ).toHaveAttribute("src", "https://example.com/avatar.png");
    expect(
      screen.queryByText("interviewer@example.com"),
    ).not.toBeInTheDocument();
  });

  it("redirects an unauthenticated user to sign in", async () => {
    getCurrentUser.mockRejectedValue(new AuthenticationRequiredError());

    await expect(DashboardPage()).rejects.toThrow("NEXT_REDIRECT");

    expect(redirect).toHaveBeenCalledWith("/sign-in");
  });

  it("renders a safe error state when the backend request fails", async () => {
    const error = new Error("connect ECONNREFUSED database.internal:5432");

    getCurrentUser.mockRejectedValue(error);

    render(await DashboardPage());

    expect(redirect).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Unable to load your dashboard",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    expect(
      screen.queryByText("connect ECONNREFUSED database.internal:5432"),
    ).not.toBeInTheDocument();
  });
});
