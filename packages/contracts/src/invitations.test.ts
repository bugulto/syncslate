import { describe, expect, it } from "vitest";

import {
  createInvitationResponseSchema,
  invitationMetadataSchema,
  rawInvitationTokenSchema,
  revokeInvitationResponseSchema,
} from "./invitations.js";

const validInvitation = {
  id: "550e8400-e29b-41d4-a716-446655440003",
  sessionId: "550e8400-e29b-41d4-a716-446655440002",
  expiresAt: "2026-09-01T11:00:00.000Z",
  consumedAt: null,
  revokedAt: null,
  createdAt: "2026-08-31T11:00:00.000Z",
};

const validRawToken = "aB3_-tokenValueThatIsLongEnoughForEntropy123456";

describe("invitationMetadataSchema", () => {
  it("accepts public invitation metadata", () => {
    expect(invitationMetadataSchema.parse(validInvitation)).toEqual(
      validInvitation,
    );
  });

  it("rejects token hashes and malformed timestamps", () => {
    expect(
      invitationMetadataSchema.safeParse({
        ...validInvitation,
        tokenHash: "stored-secret-hash",
      }).success,
    ).toBe(false);
    expect(
      invitationMetadataSchema.safeParse({
        ...validInvitation,
        expiresAt: "tomorrow",
      }).success,
    ).toBe(false);
  });
});

describe("invitation response contracts", () => {
  it("accepts a URL-safe raw token only in the creation response", () => {
    expect(rawInvitationTokenSchema.parse(validRawToken)).toBe(validRawToken);
    expect(
      createInvitationResponseSchema.parse({
        invitation: validInvitation,
        rawToken: validRawToken,
      }),
    ).toEqual({ invitation: validInvitation, rawToken: validRawToken });
  });

  it("rejects short, unsafe, or unexpected token fields", () => {
    expect(rawInvitationTokenSchema.safeParse("too-short").success).toBe(false);
    expect(
      rawInvitationTokenSchema.safeParse(
        "token-that-is-long-enough-but-has-a-+/character",
      ).success,
    ).toBe(false);
    expect(
      createInvitationResponseSchema.safeParse({
        invitation: validInvitation,
        rawToken: validRawToken,
        tokenHash: "stored-secret-hash",
      }).success,
    ).toBe(false);
  });

  it("requires a revocation timestamp in revoke responses", () => {
    const revokedInvitation = {
      ...validInvitation,
      revokedAt: "2026-08-31T12:00:00.000Z",
    };

    expect(
      revokeInvitationResponseSchema.parse({
        invitation: revokedInvitation,
      }),
    ).toEqual({ invitation: revokedInvitation });
    expect(
      revokeInvitationResponseSchema.safeParse({
        invitation: validInvitation,
      }).success,
    ).toBe(false);
  });
});
