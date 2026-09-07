"use client";

import {
  listProblemsQuerySchema,
  listProblemsResponseSchema,
  type ListProblemsQuery,
  type ProblemSummary,
} from "@syncslate/contracts";

import { createBrowserApiClient } from "./browser";
import type { AuthenticatedApiClient } from "./client";

function buildProblemListPath(query: ListProblemsQuery): string {
  const validatedQuery = listProblemsQuerySchema.parse(query);
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(validatedQuery)) {
    if (value !== undefined) {
      searchParams.set(key, value);
    }
  }

  const queryString = searchParams.toString();
  return queryString ? `/problems?${queryString}` : "/problems";
}

export async function listProblems(
  query: ListProblemsQuery = {},
  apiClient: AuthenticatedApiClient = createBrowserApiClient(),
): Promise<ProblemSummary[]> {
  const response = await apiClient.request(
    buildProblemListPath(query),
    listProblemsResponseSchema,
    {
      method: "GET",
      cache: "no-store",
    },
  );

  return response.problems;
}
