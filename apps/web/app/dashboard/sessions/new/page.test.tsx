import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthenticationRequiredError } from "../../../../lib/api/errors";
import NewSessionPage from "./page";

const { apiClient, createServerApiClient, getCurrentUser, redirect } =
  vi.hoisted(() => ({
    apiClient: { request: vi.fn() },
    createServerApiClient: vi.fn(),
    getCurrentUser: vi.fn(),
    redirect: vi.fn(),
  }));

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("../../../../lib/api/current-user", () => ({ getCurrentUser }));
vi.mock("../../../../lib/api/server", () => ({ createServerApiClient }));
vi.mock("../../../../features/sessions/session-creation-workspace", () => ({
  SessionCreationWorkspace: () => <div>Session creation workspace</div>,
}));

describe("NewSessionPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createServerApiClient.mockResolvedValue(apiClient);
    getCurrentUser.mockResolvedValue({ id: "user-id" });
    redirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
  });

  it("authenticates and renders the session creation flow", async () => {
    render(await NewSessionPage());

    expect(createServerApiClient).toHaveBeenCalledOnce();
    expect(getCurrentUser).toHaveBeenCalledWith(apiClient);
    expect(
      screen.getByRole("heading", { level: 1, name: "Create a session" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Session creation workspace")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Back to dashboard/u }),
    ).toHaveAttribute("href", "/dashboard");
  });

  it("redirects unauthenticated visitors", async () => {
    getCurrentUser.mockRejectedValue(new AuthenticationRequiredError());

    await expect(NewSessionPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/sign-in");
  });

  it("renders a safe API failure state", async () => {
    getCurrentUser.mockRejectedValue(
      new Error("connect ECONNREFUSED database.internal:5432"),
    );

    render(await NewSessionPage());

    expect(
      screen.getByRole("heading", {
        name: "Unable to start session creation",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute(
      "href",
      "/dashboard/sessions/new",
    );
    expect(screen.queryByText(/database\.internal/u)).not.toBeInTheDocument();
  });
});
