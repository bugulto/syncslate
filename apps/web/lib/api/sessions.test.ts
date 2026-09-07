import {
  createSessionResponseSchema,
  type ProblemDetail,
  type SessionDetail,
} from "@syncslate/contracts";
import { describe, expect, it, vi } from "vitest";

import type { AuthenticatedApiClient } from "./client";
import { createSession } from "./sessions";

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

function createMockApiClient() {
  const request = vi.fn(async () => ({ session }));
  const apiClient: AuthenticatedApiClient = {
    request: request as AuthenticatedApiClient["request"],
  };

  return { apiClient, request };
}

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
