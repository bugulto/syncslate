import {
  createInvitationResponseSchema,
  inspectInvitationResponseSchema,
  joinInvitationResponseSchema,
  revokeInvitationResponseSchema,
  type CreateInvitationResponse,
  type InspectInvitationResponse,
  type JoinInvitationResponse,
  type RevokeInvitationResponse,
} from "@syncslate/contracts";
import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "./client";
import {
  createSessionInvitation,
  inspectInvitation,
  joinInvitation,
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
  const apiClient: ApiClient = {
    request: request as ApiClient["request"],
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
    const apiClient: ApiClient = {
      request: request as ApiClient["request"],
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
    const apiClient: ApiClient = {
      request: request as ApiClient["request"],
    };

    await expect(revokeSessionInvitations(sessionId, apiClient)).rejects.toBe(
      failure,
    );
  });
});

const invitationPreview: InspectInvitationResponse = {
  invitation: {
    session: {
      title: "Frontend interview",
      status: "waiting",
      language: "typescript",
      durationSeconds: 3_600,
      problem: {
        title: "Two Sum",
        difficulty: "easy",
      },
    },
    expiresAt: "2026-09-20T12:00:00.000Z",
  },
};

const joinedInvitation: JoinInvitationResponse = {
  participant: {
    id: "50000000-0000-4000-8000-000000000001",
    displayName: "Candidate",
    role: "candidate",
  },
  guestAccessToken: "g".repeat(64),
  expiresAt: "2026-09-19T13:00:00.000Z",
};

describe("inspectInvitation", () => {
  it("inspects a validated invitation through the public client", async () => {
    const { apiClient, request } = createMockApiClient(invitationPreview);

    await expect(inspectInvitation(rawToken, apiClient)).resolves.toEqual(
      invitationPreview,
    );
    expect(request).toHaveBeenCalledWith(
      `/invitations/${rawToken}`,
      inspectInvitationResponseSchema,
    );
  });

  it("rejects malformed tokens before making a request", async () => {
    const { apiClient, request } = createMockApiClient(invitationPreview);

    await expect(inspectInvitation("invalid", apiClient)).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });
});

describe("joinInvitation", () => {
  it("submits a validated display name through the public client", async () => {
    const { apiClient, request } = createMockApiClient(joinedInvitation);

    await expect(
      joinInvitation(rawToken, { displayName: "  Candidate  " }, apiClient),
    ).resolves.toEqual(joinedInvitation);
    expect(request).toHaveBeenCalledWith(
      `/invitations/${rawToken}/join`,
      joinInvitationResponseSchema,
      {
        method: "POST",
        body: JSON.stringify({ displayName: "Candidate" }),
      },
    );
  });

  it("rejects malformed input before making a request", async () => {
    const { apiClient, request } = createMockApiClient(joinedInvitation);

    await expect(
      joinInvitation(rawToken, { displayName: "x" }, apiClient),
    ).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });

  it("rejects malformed tokens before making a request", async () => {
    const { apiClient, request } = createMockApiClient(joinedInvitation);

    await expect(
      joinInvitation("invalid", { displayName: "Candidate" }, apiClient),
    ).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });
});
