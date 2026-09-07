import {
  createInvitationResponseSchema,
  revokeInvitationResponseSchema,
  type CreateInvitationResponse,
  type RevokeInvitationResponse,
} from "@syncslate/contracts";
import { describe, expect, it, vi } from "vitest";

import type { AuthenticatedApiClient } from "./client";
import {
  createSessionInvitation,
  revokeSessionInvitations,
} from "./invitations";

const sessionId = "30000000-0000-4000-8000-000000000001";
const invitationId = "40000000-0000-4000-8000-000000000001";
const rawToken = "A".repeat(43);

const createdInvitation: CreateInvitationResponse = {
  invitation: {
    id: invitationId,
    sessionId,
    expiresAt: "2026-09-20T12:00:00.000Z",
    consumedAt: null,
    revokedAt: null,
    createdAt: "2026-09-19T12:00:00.000Z",
  },
  rawToken,
};

const revokedInvitation: RevokeInvitationResponse = {
  invitation: {
    ...createdInvitation.invitation,
    revokedAt: "2026-09-19T13:00:00.000Z",
  },
};

function createMockApiClient(response: unknown) {
  const request = vi.fn(async () => response);
  const apiClient: AuthenticatedApiClient = {
    request: request as AuthenticatedApiClient["request"],
  };

  return { apiClient, request };
}

describe("createSessionInvitation", () => {
  it("requests a new invitation with its shared response schema", async () => {
    const { apiClient, request } = createMockApiClient(createdInvitation);

    await expect(
      createSessionInvitation(sessionId, apiClient),
    ).resolves.toEqual(createdInvitation);
    expect(request).toHaveBeenCalledWith(
      `/sessions/${sessionId}/invitations`,
      createInvitationResponseSchema,
      { method: "POST" },
    );
  });

  it("rejects malformed session IDs before making an API request", async () => {
    const { apiClient, request } = createMockApiClient(createdInvitation);

    await expect(
      createSessionInvitation("not-a-uuid", apiClient),
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

    await expect(createSessionInvitation(sessionId, apiClient)).rejects.toBe(
      failure,
    );
  });
});

describe("revokeSessionInvitations", () => {
  it("requests invitation revocation with its shared response schema", async () => {
    const { apiClient, request } = createMockApiClient(revokedInvitation);

    await expect(
      revokeSessionInvitations(sessionId, apiClient),
    ).resolves.toEqual(revokedInvitation);
    expect(request).toHaveBeenCalledWith(
      `/sessions/${sessionId}/invitations/revoke`,
      revokeInvitationResponseSchema,
      { method: "POST" },
    );
  });

  it("rejects malformed session IDs before making an API request", async () => {
    const { apiClient, request } = createMockApiClient(revokedInvitation);

    await expect(
      revokeSessionInvitations("not-a-uuid", apiClient),
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

    await expect(revokeSessionInvitations(sessionId, apiClient)).rejects.toBe(
      failure,
    );
  });
});
