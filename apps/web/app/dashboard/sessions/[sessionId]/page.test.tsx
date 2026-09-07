import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthenticationRequiredError } from "../../../../lib/api/errors";
import SessionDetailPage from "./page";

const { apiClient, createServerApiClient, getCurrentUser, notFound, redirect } =
  vi.hoisted(() => ({
    apiClient: { request: vi.fn() },
    createServerApiClient: vi.fn(),
    getCurrentUser: vi.fn(),
    notFound: vi.fn(),
    redirect: vi.fn(),
  }));

vi.mock("next/navigation", () => ({ notFound, redirect }));
vi.mock("../../../../lib/api/current-user", () => ({ getCurrentUser }));
vi.mock("../../../../lib/api/server", () => ({ createServerApiClient }));
vi.mock("../../../../features/sessions/session-detail-workspace", () => ({
  SessionDetailWorkspace: ({ sessionId }: { sessionId: string }) => (
    <div>Detail workspace for {sessionId}</div>
  ),
}));

const sessionId = "30000000-0000-4000-8000-000000000001";

function pageProps(id = sessionId) {
  return { params: Promise.resolve({ sessionId: id }) };
}

describe("SessionDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createServerApiClient.mockResolvedValue(apiClient);
    getCurrentUser.mockResolvedValue({ id: "user-id" });
    redirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
    notFound.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });
  });

  it("authenticates and renders the requested session workspace", async () => {
    render(await SessionDetailPage(pageProps()));

    expect(createServerApiClient).toHaveBeenCalledOnce();
    expect(getCurrentUser).toHaveBeenCalledWith(apiClient);
    expect(
      screen.getByRole("heading", { level: 1, name: "Session details" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(`Detail workspace for ${sessionId}`),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Back to dashboard/u }),
    ).toHaveAttribute("href", "/dashboard");
  });

  it("redirects unauthenticated visitors", async () => {
    getCurrentUser.mockRejectedValue(new AuthenticationRequiredError());

    await expect(SessionDetailPage(pageProps())).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(redirect).toHaveBeenCalledWith("/sign-in");
  });

  it("returns not found for a malformed session ID", async () => {
    await expect(SessionDetailPage(pageProps("not-a-uuid"))).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    expect(notFound).toHaveBeenCalledOnce();
  });

  it("renders a safe authentication API failure state", async () => {
    getCurrentUser.mockRejectedValue(
      new Error("connect ECONNREFUSED database.internal:5432"),
    );

    render(await SessionDetailPage(pageProps()));

    expect(
      screen.getByRole("heading", { name: "Unable to load the session" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Return to dashboard" }),
    ).toHaveAttribute("href", "/dashboard");
    expect(screen.queryByText(/database\.internal/u)).not.toBeInTheDocument();
  });
});
