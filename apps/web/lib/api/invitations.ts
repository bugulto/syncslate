"use client";

import {
  createInvitationResponseSchema,
  revokeInvitationResponseSchema,
  sessionParamsSchema,
  type CreateInvitationResponse,
  type RevokeInvitationResponse,
} from "@syncslate/contracts";

import { createBrowserApiClient } from "./browser";
import type { AuthenticatedApiClient } from "./client";

export async function createSessionInvitation(
  sessionId: string,
  apiClient: AuthenticatedApiClient = createBrowserApiClient(),
): Promise<CreateInvitationResponse> {
  const params = sessionParamsSchema.parse({ sessionId });

  return apiClient.request(
    `/sessions/${params.sessionId}/invitations`,
    createInvitationResponseSchema,
    { method: "POST" },
  );
}

export async function revokeSessionInvitations(
  sessionId: string,
  apiClient: AuthenticatedApiClient = createBrowserApiClient(),
): Promise<RevokeInvitationResponse> {
  const params = sessionParamsSchema.parse({ sessionId });

  return apiClient.request(
    `/sessions/${params.sessionId}/invitations/revoke`,
    revokeInvitationResponseSchema,
    { method: "POST" },
  );
}
