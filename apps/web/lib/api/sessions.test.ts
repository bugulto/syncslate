import {
  createSessionResponseSchema,
  getSessionResponseSchema,
  listSessionsResponseSchema,
  type ProblemDetail,
  type SessionDetail,
  type SessionSummary,
} from "@syncslate/contracts";
import { describe, expect, it, vi } from "vitest";

import type { AuthenticatedApiClient } from "./client";
import { createSession, getSession, listSessions } from "./sessions";

const problemId = "10000000-0000-4000-8000-000000000001";

const problem: ProblemDetail = {
  id: problemId,
  title: "Two Sum",
  slug: "two-sum",
  difficulty: "easy",
  tags: ["arrays"],
  visibility: "seeded",
  availableLanguages: ["typescript"],
  descriptionMarkdown: "Find two values.",
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
  id: "30000000-0000-4000-8000-000000000001",
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

const input = {
  title: "  Frontend interview  ",
  problemId,
  language: "typescript" as const,
  durationSeconds: 3600,
};

const olderSession: SessionSummary = {
  id: "30000000-0000-4000-8000-000000000002",
  title: "Older interview",
  status: "completed",
  language: "python",
  editingPolicy: "candidate_only",
  durationSeconds: 1800,
  problem: null,
  createdAt: "2026-09-18T12:00:00.000Z",
  updatedAt: "2026-09-18T13:00:00.000Z",
};

const newerSession: SessionSummary = {
  id: session.id,
  title: session.title,
  status: session.status,
  language: session.language,
  editingPolicy: session.editingPolicy,
  durationSeconds: session.durationSeconds,
  problem: {
    id: problem.id,
    title: problem.title,
    slug: problem.slug,
    difficulty: problem.difficulty,
    tags: problem.tags,
    visibility: problem.visibility,
    availableLanguages: problem.availableLanguages,
  },
  createdAt: session.createdAt,
  updatedAt: session.updatedAt,
};

function createMockApiClient() {
  const request = vi.fn(async () => ({ session }));
  const apiClient: AuthenticatedApiClient = {
    request: request as AuthenticatedApiClient["request"],
  };

  return { apiClient, request };
}

describe("listSessions", () => {
  it("requests the authenticated session list and returns it newest first", async () => {
    const request = vi.fn(async () => ({
      sessions: [olderSession, newerSession],
    }));
    const apiClient: AuthenticatedApiClient = {
      request: request as AuthenticatedApiClient["request"],
    };

    await expect(listSessions(apiClient)).resolves.toEqual([
      newerSession,
      olderSession,
    ]);
    expect(request).toHaveBeenCalledWith(
      "/sessions",
      listSessionsResponseSchema,
      {
        method: "GET",
        cache: "no-store",
      },
    );
  });

  it("propagates safe API client failures", async () => {
    const failure = new Error("request failed");
    const request = vi.fn(async () => {
      throw failure;
    });
    const apiClient: AuthenticatedApiClient = {
      request: request as AuthenticatedApiClient["request"],
    };

    await expect(listSessions(apiClient)).rejects.toBe(failure);
  });
});

describe("getSession", () => {
  it("requests an uncached session detail with its shared schema", async () => {
    const { apiClient, request } = createMockApiClient();

    await expect(getSession(session.id, apiClient)).resolves.toEqual(session);
    expect(request).toHaveBeenCalledWith(
      `/sessions/${session.id}`,
      getSessionResponseSchema,
      {
        method: "GET",
        cache: "no-store",
      },
    );
  });

  it("rejects malformed session IDs before making an API request", async () => {
    const { apiClient, request } = createMockApiClient();

    await expect(getSession("not-a-uuid", apiClient)).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });

  it("propagates safe API client failures", async () => {
    const failure = new Error("request failed");
    const request = vi.fn(async () => {
      throw failure;
    });
    const apiClient: AuthenticatedApiClient = {
      request: request as AuthenticatedApiClient["request"],
    };

    await expect(getSession(session.id, apiClient)).rejects.toBe(failure);
  });
});

describe("createSession", () => {
  it("normalizes and sends a validated session creation request", async () => {
    const { apiClient, request } = createMockApiClient();

    await expect(createSession(input, apiClient)).resolves.toEqual(session);
    expect(request).toHaveBeenCalledWith(
      "/sessions",
      createSessionResponseSchema,
      {
        method: "POST",
        body: JSON.stringify({
          ...input,
          title: "Frontend interview",
        }),
      },
    );
  });

  it("rejects invalid input before making an API request", async () => {
    const { apiClient, request } = createMockApiClient();

    await expect(
      createSession({ ...input, durationSeconds: 60 }, apiClient),
    ).rejects.toThrow("Duration must be at least 5 minutes");
    expect(request).not.toHaveBeenCalled();
  });

  it("propagates safe API client failures", async () => {
    const failure = new Error("request failed");
    const request = vi.fn(async () => {
      throw failure;
    });
    const apiClient: AuthenticatedApiClient = {
      request: request as AuthenticatedApiClient["request"],
    };

    await expect(createSession(input, apiClient)).rejects.toBe(failure);
  });
});
