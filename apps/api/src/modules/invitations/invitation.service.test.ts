import { createHmac } from "node:crypto";

import type { InvitationMetadata } from "@syncslate/contracts";
import { describe, expect, it, vi } from "vitest";

import type {
  AdmitCandidateByTokenHashRepository,
  CreateInvitationForOwnedSessionRepository,
  FindInvitationPreviewByTokenHashRepository,
  RevokeInvitationForOwnedSessionRepository,
} from "./invitation.dependencies.js";
import {
  createInvitationCreationService,
  createInvitationInspectionService,
  createInvitationJoinService,
  createInvitationRevocationService,
  DEFAULT_INVITATION_TTL_MS,
} from "./invitation.service.js";

const interviewerId = "550e8400-e29b-41d4-a716-446655440000";
const sessionId = "30000000-0000-4000-8000-000000000001";
const invitationId = "40000000-0000-4000-8000-000000000001";
const rawToken = "A".repeat(43);
const tokenPepper = "test-invitation-token-pepper-12345";
const now = new Date("2026-09-19T12:00:00.000Z");
const participantId = "50000000-0000-4000-8000-000000000001";

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

describe("createInvitationInspectionService", () => {
  const previewRow = {
    sessionId,
    expiresAt: new Date("2026-09-20T12:00:00.000Z"),
    consumedAt: null,
    revokedAt: null,
    candidateParticipantId: null,
    session: {
      title: "Backend interview",
      status: "waiting" as const,
      language: "typescript" as const,
      durationSeconds: 3_600,
      problem: { title: "Two Sum", difficulty: "easy" as const },
    },
  };

  it("returns the minimal preview and does not expose storage metadata", async () => {
    const findInvitationPreviewByTokenHash = vi
      .fn<FindInvitationPreviewByTokenHashRepository>()
      .mockResolvedValue(previewRow);
    const service = createInvitationInspectionService({
      findInvitationPreviewByTokenHash,
      tokenPepper,
      now: () => now,
    });

    const result = await service({ rawToken });
    expect(result).toEqual({
      kind: "available",
      invitation: {
        session: previewRow.session,
        expiresAt: previewRow.expiresAt.toISOString(),
      },
    });
    expect(result).not.toHaveProperty("sessionId");
    expect(result).not.toHaveProperty("tokenHash");
    expect(findInvitationPreviewByTokenHash).toHaveBeenCalledWith({
      tokenHash: createHmac("sha256", tokenPepper)
        .update(rawToken)
        .digest("hex"),
    });
  });

  it.each([
    ["not_found", null],
    ["expired", { ...previewRow, expiresAt: now }],
    ["revoked", { ...previewRow, revokedAt: now }],
    ["consumed", { ...previewRow, consumedAt: now }],
    [
      "session_closed",
      {
        ...previewRow,
        session: { ...previewRow.session, status: "completed" },
      },
    ],
    ["session_full", { ...previewRow, candidateParticipantId: participantId }],
  ] as const)("returns %s for an unavailable invitation", async (kind, row) => {
    const service = createInvitationInspectionService({
      findInvitationPreviewByTokenHash: vi
        .fn<FindInvitationPreviewByTokenHashRepository>()
        .mockResolvedValue(row),
      tokenPepper,
      now: () => now,
    });

    await expect(service({ rawToken })).resolves.toEqual({ kind });
  });
});

describe("createInvitationJoinService", () => {
  it("atomically admits the candidate before issuing a scoped token", async () => {
    const admitCandidateByTokenHash = vi
      .fn<AdmitCandidateByTokenHashRepository>()
      .mockResolvedValue({
        kind: "joined",
        sessionId,
        participant: {
          id: participantId,
          displayName: "Grace Hopper",
          role: "candidate",
        },
      });
    const issueGuestToken = vi.fn(async () => ({
      token: "guest-access-token-".repeat(8),
      expiresAt: new Date("2026-09-19T12:30:00.000Z"),
    }));
    const service = createInvitationJoinService({
      admitCandidateByTokenHash,
      issueGuestToken,
      tokenPepper,
      now: () => now,
    });

    await expect(
      service({ rawToken, displayName: "Grace Hopper" }),
    ).resolves.toMatchObject({
      kind: "joined",
      guestAccessToken: "guest-access-token-".repeat(8),
      expiresAt: "2026-09-19T12:30:00.000Z",
    });
    expect(admitCandidateByTokenHash).toHaveBeenCalledWith({
      tokenHash: createHmac("sha256", tokenPepper)
        .update(rawToken)
        .digest("hex"),
      displayName: "Grace Hopper",
      now,
    });
    expect(issueGuestToken).toHaveBeenCalledWith({ participantId, sessionId });
  });

  it("does not issue a token when admission fails", async () => {
    const issueGuestToken = vi.fn();
    const service = createInvitationJoinService({
      admitCandidateByTokenHash: vi
        .fn<AdmitCandidateByTokenHashRepository>()
        .mockResolvedValue({ kind: "consumed" }),
      issueGuestToken,
      tokenPepper,
      now: () => now,
    });

    await expect(
      service({ rawToken, displayName: "Grace Hopper" }),
    ).resolves.toEqual({ kind: "consumed" });
    expect(issueGuestToken).not.toHaveBeenCalled();
  });
});
