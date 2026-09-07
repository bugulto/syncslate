"use client";

import {
  createSessionRequestSchema,
  createSessionResponseSchema,
  getSessionResponseSchema,
  listSessionsResponseSchema,
  sessionParamsSchema,
  type CreateSessionRequest,
  type SessionDetail,
  type SessionSummary,
} from "@syncslate/contracts";

import { createBrowserApiClient } from "./browser";
import type { AuthenticatedApiClient } from "./client";

export async function listSessions(
  apiClient: AuthenticatedApiClient = createBrowserApiClient(),
): Promise<SessionSummary[]> {
  const response = await apiClient.request(
    "/sessions",
    listSessionsResponseSchema,
    {
      method: "GET",
      cache: "no-store",
    },
  );

  return [...response.sessions].sort(
    (first, second) =>
      new Date(second.createdAt).getTime() -
      new Date(first.createdAt).getTime(),
  );
}

export async function getSession(
  sessionId: string,
  apiClient: AuthenticatedApiClient = createBrowserApiClient(),
): Promise<SessionDetail> {
  const params = sessionParamsSchema.parse({ sessionId });
  const response = await apiClient.request(
    `/sessions/${params.sessionId}`,
    getSessionResponseSchema,
    {
      method: "GET",
      cache: "no-store",
    },
  );

  return response.session;
}

export async function createSession(
  input: CreateSessionRequest,
  apiClient: AuthenticatedApiClient = createBrowserApiClient(),
): Promise<SessionDetail> {
  const validatedInput = createSessionRequestSchema.parse(input);
  const response = await apiClient.request(
    "/sessions",
    createSessionResponseSchema,
    {
      method: "POST",
      body: JSON.stringify(validatedInput),
    },
  );

  return response.session;
}
