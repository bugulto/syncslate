import type {
  CreateInvitationResponse,
  ProblemDetail,
  RevokeInvitationResponse,
  SessionDetail,
} from "@syncslate/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createSessionInvitation,
  revokeSessionInvitations,
} from "../../lib/api/invitations";
import { ApiRequestError } from "../../lib/api/errors";
import { getSession } from "../../lib/api/sessions";
import { SessionDetailWorkspace } from "./session-detail-workspace";

vi.mock("../../lib/api/invitations", () => ({
  createSessionInvitation: vi.fn(),
  revokeSessionInvitations: vi.fn(),
}));

vi.mock("../../lib/api/sessions", () => ({
  getSession: vi.fn(),
}));

const sessionId = "30000000-0000-4000-8000-000000000001";
const problem: ProblemDetail = {
  id: "10000000-0000-4000-8000-000000000001",
  title: "Two Sum",
  slug: "two-sum",
  difficulty: "easy",
  tags: ["arrays", "hash map"],
  visibility: "seeded",
  availableLanguages: ["typescript"],
  descriptionMarkdown: "Find two numbers that add up to a target.",
  constraintsMarkdown: null,
  examples: [],
  interviewerNotesMarkdown: null,
  starterCode: [
    { language: "typescript", code: "export function twoSum() {}" },
  ],
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

const session: SessionDetail = {
  id: sessionId,
  title: "Frontend interview",
  status: "waiting",
  language: "typescript",
  editingPolicy: "candidate_only",
  durationSeconds: 3600,
  problem,
  startedAt: null,
  endedAt: null,
  createdAt: "2026-09-19T12:00:00.000Z",
  updatedAt: "2026-09-19T12:00:00.000Z",
};

const invitation: CreateInvitationResponse = {
  invitation: {
    id: "40000000-0000-4000-8000-000000000001",
    sessionId,
    expiresAt: "2026-09-20T12:00:00.000Z",
    consumedAt: null,
    revokedAt: null,
    createdAt: "2026-09-19T12:00:00.000Z",
  },
  rawToken: "A".repeat(43),
};

const revokedInvitation: RevokeInvitationResponse = {
  invitation: {
    ...invitation.invitation,
    revokedAt: "2026-09-19T13:00:00.000Z",
  },
};

function renderWorkspace() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <SessionDetailWorkspace sessionId={sessionId} />
    </QueryClientProvider>,
  );
}

describe("SessionDetailWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn(async () => undefined) },
    });
  });

  it("shows an initial session loading state", () => {
    vi.mocked(getSession).mockReturnValue(new Promise(() => undefined));

    renderWorkspace();

    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading session details",
    );
    expect(getSession).toHaveBeenCalledWith(sessionId);
  });

  it("renders waiting status, session metadata, and the selected problem", async () => {
    vi.mocked(getSession).mockResolvedValue(session);

    renderWorkspace();

    expect(
      await screen.findByText("Waiting for candidate"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Frontend interview" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Waiting")).toBeInTheDocument();
    expect(screen.getByText("Typescript")).toBeInTheDocument();
    expect(screen.getByText("60 minutes")).toBeInTheDocument();
    expect(screen.getByText("Candidate Only")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Two Sum" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Easy")).toBeInTheDocument();
    expect(screen.getByText("arrays · hash map")).toBeInTheDocument();
    expect(
      screen.getByText("Find two numbers that add up to a target."),
    ).toBeInTheDocument();
  });

  it("renders a safe not-found state without retrying", async () => {
    vi.mocked(getSession).mockRejectedValue(
      new ApiRequestError({ status: 404 }),
    );

    renderWorkspace();

    expect(
      await screen.findByRole("heading", { name: "Session not found" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Retry" }),
    ).not.toBeInTheDocument();
  });

  it("renders a safe failure state and retries", async () => {
    vi.mocked(getSession)
      .mockRejectedValueOnce(new Error("sensitive backend failure"))
      .mockResolvedValueOnce(session);
    renderWorkspace();

    expect(
      await screen.findByRole("heading", {
        name: "Unable to load the session",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("sensitive backend failure"),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(
      await screen.findByRole("heading", { name: "Frontend interview" }),
    ).toBeInTheDocument();
    expect(getSession).toHaveBeenCalledTimes(2);
  });

  it("handles a deleted selected problem", async () => {
    vi.mocked(getSession).mockResolvedValue({ ...session, problem: null });

    renderWorkspace();

    expect(
      await screen.findByRole("heading", {
        name: "Problem no longer available",
      }),
    ).toBeInTheDocument();
  });

  it("generates a one-time candidate link and shows its expiry", async () => {
    vi.mocked(getSession).mockResolvedValue(session);
    vi.mocked(createSessionInvitation).mockResolvedValue(invitation);
    const storageSpy = vi.spyOn(Storage.prototype, "setItem");
    renderWorkspace();
    const generateButton = await screen.findByRole("button", {
      name: "Generate invitation",
    });

    fireEvent.click(generateButton);

    expect(await screen.findByText("Invitation generated")).toBeInTheDocument();
    expect(createSessionInvitation).toHaveBeenCalledWith(sessionId);
    expect(
      screen.getByRole("textbox", { name: "Candidate invitation link" }),
    ).toHaveValue(
      new URL(
        `/join/${invitation.rawToken}`,
        window.location.origin,
      ).toString(),
    );
    expect(screen.getByText(/^Expires /u)).toBeInTheDocument();
    expect(storageSpy).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: "Generate invitation" }),
    ).not.toBeInTheDocument();
    storageSpy.mockRestore();
  });

  it("copies the candidate link and reports success", async () => {
    vi.mocked(getSession).mockResolvedValue(session);
    vi.mocked(createSessionInvitation).mockResolvedValue(invitation);
    renderWorkspace();
    fireEvent.click(
      await screen.findByRole("button", { name: "Generate invitation" }),
    );
    const link = new URL(
      `/join/${invitation.rawToken}`,
      window.location.origin,
    ).toString();

    fireEvent.click(
      await screen.findByRole("button", { name: "Copy invitation link" }),
    );

    expect(
      await screen.findByRole("button", { name: "Copied" }),
    ).toBeInTheDocument();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(link);
  });

  it("shows a manual-copy fallback when clipboard access fails", async () => {
    vi.mocked(getSession).mockResolvedValue(session);
    vi.mocked(createSessionInvitation).mockResolvedValue(invitation);
    vi.mocked(navigator.clipboard.writeText).mockRejectedValue(
      new Error("clipboard denied"),
    );
    renderWorkspace();
    fireEvent.click(
      await screen.findByRole("button", { name: "Generate invitation" }),
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Copy invitation link" }),
    );

    expect(
      await screen.findByText(
        "Unable to copy the link. Select and copy it manually.",
      ),
    ).toBeInTheDocument();
  });

  it("revokes the invitation, removes its raw link, and permits regeneration", async () => {
    vi.mocked(getSession).mockResolvedValue(session);
    vi.mocked(createSessionInvitation).mockResolvedValue(invitation);
    vi.mocked(revokeSessionInvitations).mockResolvedValue(revokedInvitation);
    renderWorkspace();
    fireEvent.click(
      await screen.findByRole("button", { name: "Generate invitation" }),
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Revoke invitation" }),
    );

    expect(await screen.findByText(/Invitation revoked/u)).toBeInTheDocument();
    expect(revokeSessionInvitations).toHaveBeenCalledWith(sessionId);
    expect(
      screen.queryByRole("textbox", { name: "Candidate invitation link" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Generate new invitation" }),
    ).toBeEnabled();
  });

  it("keeps the invitation visible when revocation fails", async () => {
    vi.mocked(getSession).mockResolvedValue(session);
    vi.mocked(createSessionInvitation).mockResolvedValue(invitation);
    vi.mocked(revokeSessionInvitations).mockRejectedValue(
      new Error("sensitive revocation failure"),
    );
    renderWorkspace();
    fireEvent.click(
      await screen.findByRole("button", { name: "Generate invitation" }),
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Revoke invitation" }),
    );

    const alert = await screen.findByText(
      "We could not revoke the invitation. Please try again.",
    );
    expect(alert).toBeInTheDocument();
    expect(
      screen.queryByText("sensitive revocation failure"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "Candidate invitation link" }),
    ).toBeInTheDocument();
  });

  it("disables generation while pending and shows a safe failure", async () => {
    vi.mocked(getSession).mockResolvedValue(session);
    let rejectInvitation: ((reason: Error) => void) | undefined;
    vi.mocked(createSessionInvitation).mockReturnValue(
      new Promise((_, reject) => {
        rejectInvitation = reject;
      }),
    );
    renderWorkspace();
    fireEvent.click(
      await screen.findByRole("button", { name: "Generate invitation" }),
    );

    expect(
      await screen.findByRole("button", { name: "Generating invitation…" }),
    ).toBeDisabled();
    rejectInvitation?.(new Error("sensitive token failure"));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "We could not generate the invitation. Please try again.",
    );
    expect(alert).not.toHaveTextContent("sensitive token failure");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Generate invitation" }),
      ).toBeEnabled(),
    );
  });
});
