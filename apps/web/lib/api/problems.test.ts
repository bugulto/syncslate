import {
  listProblemsResponseSchema,
  type ProblemSummary,
} from "@syncslate/contracts";
import { describe, expect, it, vi } from "vitest";

import type { AuthenticatedApiClient } from "./client";
import { listProblems } from "./problems";

const problem: ProblemSummary = {
  id: "10000000-0000-4000-8000-000000000001",
  title: "Two Sum",
  slug: "two-sum",
  difficulty: "easy",
  tags: ["arrays", "hash map"],
  visibility: "seeded",
  availableLanguages: ["typescript", "python"],
};

function createMockApiClient() {
  const request = vi.fn(async () => ({ problems: [problem] }));
  const apiClient: AuthenticatedApiClient = {
    request: request as AuthenticatedApiClient["request"],
  };

  return { apiClient, request };
}

describe("listProblems", () => {
  it("requests all visible problems when filters are empty", async () => {
    const { apiClient, request } = createMockApiClient();

    await expect(listProblems({}, apiClient)).resolves.toEqual([problem]);
    expect(request).toHaveBeenCalledWith(
      "/problems",
      listProblemsResponseSchema,
      { method: "GET", cache: "no-store" },
    );
  });

  it("normalizes and URL-encodes supported filters", async () => {
    const { apiClient, request } = createMockApiClient();

    await listProblems(
      {
        q: "  array pairs  ",
        difficulty: "easy",
        tag: "hash map",
        language: "typescript",
      },
      apiClient,
    );

    expect(request).toHaveBeenCalledWith(
      "/problems?q=array+pairs&difficulty=easy&tag=hash+map&language=typescript",
      listProblemsResponseSchema,
      { method: "GET", cache: "no-store" },
    );
  });

  it("rejects invalid filters before making an API request", async () => {
    const { apiClient, request } = createMockApiClient();

    await expect(
      listProblems({ difficulty: "expert" } as never, apiClient),
    ).rejects.toThrow();
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

    await expect(listProblems({}, apiClient)).rejects.toBe(failure);
  });
});
