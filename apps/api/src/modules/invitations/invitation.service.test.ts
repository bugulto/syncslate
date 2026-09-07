import { createHmac } from "node:crypto";

import type { InvitationMetadata } from "@syncslate/contracts";
import { describe, expect, it, vi } from "vitest";

import type {
  CreateInvitationForOwnedSessionRepository,
  RevokeInvitationForOwnedSessionRepository,
} from "./invitation.dependencies.js";
import {
  createInvitationCreationService,
  createInvitationRevocationService,
  DEFAULT_INVITATION_TTL_MS,
} from "./invitation.service.js";

const interviewerId = "550e8400-e29b-41d4-a716-446655440000";
const sessionId = "30000000-0000-4000-8000-000000000001";
const invitationId = "40000000-0000-4000-8000-000000000001";
const rawToken = "A".repeat(43);
const tokenPepper = "test-invitation-token-pepper-12345";
const now = new Date("2026-09-19T12:00:00.000Z");

const invitation: InvitationMetadata = {
  id: invitationId,
  sessionId,
  expiresAt: "2026-09-20T12:00:00.000Z",
  consumedAt: null,
  revokedAt: null,
  createdAt: now.toISOString(),
};

describe("createInvitationCreationService", () => {
  it("stores only the hash with the correct expiry and returns the raw token", async () => {
    const createInvitationForOwnedSession = vi
      .fn<CreateInvitationForOwnedSessionRepository>()
      .mockResolvedValue(invitation);
    const service = createInvitationCreationService({
      createInvitationForOwnedSession,
      tokenPepper,
      generateToken: () => rawToken,
      now: () => now,
    });

    await expect(service({ interviewerId, sessionId })).resolves.toEqual({
      kind: "created",
      invitation,
      rawToken,
    });

    const expectedHash = createHmac("sha256", tokenPepper)
      .update(rawToken)
      .digest("hex");
    expect(createInvitationForOwnedSession).toHaveBeenCalledWith({
      interviewerId,
      sessionId,
      tokenHash: expectedHash,
      expiresAt: new Date(now.getTime() + DEFAULT_INVITATION_TTL_MS),
    });
    expect(
      createInvitationForOwnedSession.mock.calls[0]?.[0],
    ).not.toHaveProperty("rawToken");
  });

  it("returns a safe result when the session is missing or not owned", async () => {
    const createInvitationForOwnedSession = vi
      .fn<CreateInvitationForOwnedSessionRepository>()
      .mockResolvedValue(null);
    const service = createInvitationCreationService({
      createInvitationForOwnedSession,
      tokenPepper,
      generateToken: () => rawToken,
      now: () => now,
    });

    await expect(service({ interviewerId, sessionId })).resolves.toEqual({
      kind: "session_not_found",
    });
  });

  it("allows repository errors to reach the route boundary", async () => {
    const service = createInvitationCreationService({
      createInvitationForOwnedSession: vi
        .fn<CreateInvitationForOwnedSessionRepository>()
        .mockRejectedValue(new Error("database unavailable")),
      tokenPepper,
      generateToken: () => rawToken,
      now: () => now,
    });

    await expect(service({ interviewerId, sessionId })).rejects.toThrow(
      "database unavailable",
    );
  });
});

describe("createInvitationRevocationService", () => {
  it("revokes active invitations using the authenticated owner and current time", async () => {
    const revokedInvitation = {
      ...invitation,
      revokedAt: now.toISOString(),
    };
    const revokeInvitationForOwnedSession = vi
      .fn<RevokeInvitationForOwnedSessionRepository>()
      .mockResolvedValue(revokedInvitation);
    const service = createInvitationRevocationService({
      revokeInvitationForOwnedSession,
      now: () => now,
    });

    await expect(service({ interviewerId, sessionId })).resolves.toEqual({
      kind: "revoked",
      invitation: revokedInvitation,
    });
    expect(revokeInvitationForOwnedSession).toHaveBeenCalledWith({
      interviewerId,
      sessionId,
      revokedAt: now,
    });
  });

  it("returns a safe result when no owned active invitation exists", async () => {
    const service = createInvitationRevocationService({
      revokeInvitationForOwnedSession: vi
        .fn<RevokeInvitationForOwnedSessionRepository>()
        .mockResolvedValue(null),
      now: () => now,
    });

    await expect(service({ interviewerId, sessionId })).resolves.toEqual({
      kind: "invitation_not_found",
    });
  });

  it("rejects inconsistent repository results", async () => {
    const service = createInvitationRevocationService({
      revokeInvitationForOwnedSession: vi
        .fn<RevokeInvitationForOwnedSessionRepository>()
        .mockResolvedValue(invitation),
      now: () => now,
    });

    await expect(service({ interviewerId, sessionId })).rejects.toThrow(
      "missing its revocation timestamp",
    );
  });
});
