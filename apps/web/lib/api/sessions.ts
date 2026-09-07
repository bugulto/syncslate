"use client";

import {
  createSessionRequestSchema,
  createSessionResponseSchema,
  type CreateSessionRequest,
  type SessionDetail,
} from "@syncslate/contracts";

import { createBrowserApiClient } from "./browser";
import type { AuthenticatedApiClient } from "./client";

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
