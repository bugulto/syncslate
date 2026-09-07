import type { SessionSummary } from "@syncslate/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { listSessions } from "../../lib/api/sessions";
import { SessionList } from "./session-list";

vi.mock("../../lib/api/sessions", () => ({
  listSessions: vi.fn(),
}));

const newerSession: SessionSummary = {
  id: "30000000-0000-4000-8000-000000000001",
  title: "Frontend interview",
  status: "waiting",
  language: "typescript",
  editingPolicy: "candidate_only",
  durationSeconds: 3600,
  problem: {
    id: "10000000-0000-4000-8000-000000000001",
    title: "Two Sum",
    slug: "two-sum",
    difficulty: "easy",
    tags: ["arrays"],
    visibility: "seeded",
    availableLanguages: ["typescript"],
  },
  createdAt: "2026-09-19T12:00:00.000Z",
  updatedAt: "2026-09-19T12:00:00.000Z",
};

const olderSession: SessionSummary = {
  id: "30000000-0000-4000-8000-000000000002",
  title: "Backend interview",
  status: "completed",
  language: "python",
  editingPolicy: "candidate_only",
  durationSeconds: 1800,
  problem: null,
  createdAt: "2026-09-18T12:00:00.000Z",
  updatedAt: "2026-09-18T13:00:00.000Z",
};

function renderSessionList() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <SessionList />
    </QueryClientProvider>,
  );
}

describe("SessionList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a loading state", () => {
    vi.mocked(listSessions).mockReturnValue(new Promise(() => undefined));

    renderSessionList();

    expect(screen.getByRole("status")).toHaveTextContent("Loading interviews");
  });

  it("shows an empty state", async () => {
    vi.mocked(listSessions).mockResolvedValue([]);

    renderSessionList();

    expect(
      await screen.findByRole("heading", { name: "No interviews yet" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Create your first interview to get started."),
    ).toBeInTheDocument();
  });

  it("renders newest-first sessions with detail links", async () => {
    vi.mocked(listSessions).mockResolvedValue([newerSession, olderSession]);

    renderSessionList();

    const links = await screen.findAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute(
      "href",
      `/dashboard/sessions/${newerSession.id}`,
    );
    expect(links[1]).toHaveAttribute(
      "href",
      `/dashboard/sessions/${olderSession.id}`,
    );
    expect(screen.getByText("Two Sum")).toBeInTheDocument();
    expect(screen.getByText("Problem no longer available")).toBeInTheDocument();
    expect(screen.getByText("Waiting")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
  });

  it("shows a safe failure and retries", async () => {
    vi.mocked(listSessions)
      .mockRejectedValueOnce(new Error("sensitive backend failure"))
      .mockResolvedValueOnce([]);
    renderSessionList();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to load interviews",
    );
    expect(
      screen.queryByText("sensitive backend failure"),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(
      await screen.findByRole("heading", { name: "No interviews yet" }),
    ).toBeInTheDocument();
    expect(listSessions).toHaveBeenCalledTimes(2);
  });
});
