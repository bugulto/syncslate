"use client";

import {
  createInvitationResponseSchema,
  inspectInvitationResponseSchema,
  invitationParamsSchema,
  joinInvitationRequestSchema,
  joinInvitationResponseSchema,
  revokeInvitationResponseSchema,
  sessionParamsSchema,
  type CreateInvitationResponse,
  type InspectInvitationResponse,
  type JoinInvitationRequest,
  type JoinInvitationResponse,
  type RevokeInvitationResponse,
} from "@syncslate/contracts";

import {
  createBrowserApiClient,
  createPublicBrowserApiClient,
} from "./browser";
import type { AuthenticatedApiClient, PublicApiClient } from "./client";

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

export async function inspectInvitation(
  rawToken: string,
  apiClient: PublicApiClient = createPublicBrowserApiClient(),
): Promise<InspectInvitationResponse> {
  const params = invitationParamsSchema.parse({ rawToken });

  return apiClient.request(
    `/invitations/${params.rawToken}`,
    inspectInvitationResponseSchema,
  );
}

export async function joinInvitation(
  rawToken: string,
  input: JoinInvitationRequest,
  apiClient: PublicApiClient = createPublicBrowserApiClient(),
): Promise<JoinInvitationResponse> {
  const params = invitationParamsSchema.parse({ rawToken });
  const body = joinInvitationRequestSchema.parse(input);

  return apiClient.request(
    `/invitations/${params.rawToken}/join`,
    joinInvitationResponseSchema,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}
