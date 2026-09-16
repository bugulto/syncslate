import type {
  InspectInvitationResponse,
  JoinInvitationResponse,
} from "@syncslate/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { inspectInvitation, joinInvitation } from "../../lib/api/invitations";
import { CandidateWaitingRoom } from "./candidate-waiting-room";

vi.mock("../../lib/api/invitations", () => ({
  inspectInvitation: vi.fn(),
  joinInvitation: vi.fn(),
}));

const inviteToken = "A".repeat(43);
const preview: InspectInvitationResponse = {
  invitation: {
    session: {
      title: "Frontend interview",
      status: "waiting",
      language: "typescript",
      durationSeconds: 3_600,
      problem: {
        title: "Two Sum",
        difficulty: "easy",
      },
    },
    expiresAt: "2026-09-28T12:00:00.000Z",
  },
};
const joined: JoinInvitationResponse = {
  participant: {
    id: "50000000-0000-4000-8000-000000000001",
    displayName: "Candidate Name",
    role: "candidate",
  },
  guestAccessToken: "g".repeat(64),
  expiresAt: "2026-09-27T13:00:00.000Z",
};

function renderWaitingRoom() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <CandidateWaitingRoom inviteToken={inviteToken} />
    </QueryClientProvider>,
  );
}

describe("CandidateWaitingRoom", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("checks the invitation before rendering the form", async () => {
    let resolvePreview:
      ((value: InspectInvitationResponse) => void) | undefined;
    vi.mocked(inspectInvitation).mockReturnValue(
      new Promise((resolve) => {
        resolvePreview = resolve;
      }),
    );

    renderWaitingRoom();

    expect(screen.getByRole("status")).toHaveTextContent(
      "Checking your invitation",
    );
    expect(
      screen.queryByRole("button", { name: "Join interview" }),
    ).not.toBeInTheDocument();

    resolvePreview?.(preview);

    expect(
      await screen.findByRole("heading", { name: "Frontend interview" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Join interview" }),
    ).toBeInTheDocument();
  });

  it("shows the candidate-safe invitation preview", async () => {
    vi.mocked(inspectInvitation).mockResolvedValue(preview);

    renderWaitingRoom();

    expect(
      await screen.findByRole("heading", { name: "Frontend interview" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Waiting")).toBeInTheDocument();
    expect(screen.getByText("Typescript")).toBeInTheDocument();
    expect(screen.getByText("60 minutes")).toBeInTheDocument();
    expect(screen.getByText("Two Sum")).toBeInTheDocument();
    expect(screen.getByText("Easy")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Display name" })).toHaveFocus();
  });

  it("validates the display name before joining", async () => {
    vi.mocked(inspectInvitation).mockResolvedValue(preview);

    renderWaitingRoom();

    const input = await screen.findByRole("textbox", { name: "Display name" });
    fireEvent.change(input, { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Join interview" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Display name must be at least 3 characters",
    );
    expect(joinInvitation).not.toHaveBeenCalled();
  });

  it("joins and retains the credential only in mutation memory", async () => {
    vi.mocked(inspectInvitation).mockResolvedValue(preview);
    vi.mocked(joinInvitation).mockResolvedValue(joined);
    const localStorageSet = vi.spyOn(Storage.prototype, "setItem");

    renderWaitingRoom();

    const input = await screen.findByRole("textbox", { name: "Display name" });
    fireEvent.change(input, { target: { value: "  Candidate Name  " } });
    fireEvent.click(screen.getByRole("button", { name: "Join interview" }));

    await waitFor(() => {
      expect(joinInvitation).toHaveBeenCalledWith(inviteToken, {
        displayName: "Candidate Name",
      });
    });
    expect(
      await screen.findByRole("heading", { name: "Welcome, Candidate Name" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(joined.guestAccessToken)).not.toBeInTheDocument();
    expect(localStorageSet).not.toHaveBeenCalled();
    localStorageSet.mockRestore();
  });

  it("shows an inspection failure and retries", async () => {
    vi.mocked(inspectInvitation)
      .mockRejectedValueOnce(new Error("unavailable"))
      .mockResolvedValueOnce(preview);

    renderWaitingRoom();

    expect(
      await screen.findByRole("heading", {
        name: "Unable to open this invitation",
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(
      await screen.findByRole("heading", { name: "Frontend interview" }),
    ).toBeInTheDocument();
  });
});
