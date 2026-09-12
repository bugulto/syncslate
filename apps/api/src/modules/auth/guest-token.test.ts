import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";

import { createGuestTokenService } from "./guest-token.js";

const participantId = "50000000-0000-4000-8000-000000000001";
const sessionId = "30000000-0000-4000-8000-000000000001";
const secret = "test-guest-token-secret-at-least-32-characters";
const now = new Date("2026-09-21T12:00:00.000Z");

describe("guest token service", () => {
  it("issues and verifies a short-lived room-scoped candidate token", async () => {
    const service = createGuestTokenService({
      secret,
      ttlSeconds: 900,
      now: () => now,
    });
    const issued = await service.issue({ participantId, sessionId });

    expect(issued.expiresAt.toISOString()).toBe("2026-09-21T12:15:00.000Z");
    await expect(
      service.verify(issued.token, { participantId, sessionId }),
    ).resolves.toEqual({
      kind: "guest",
      participantId,
      sessionId,
      role: "candidate",
    });
  });

  it("rejects expired, tampered, and incorrectly bound tokens", async () => {
    const issuer = createGuestTokenService({
      secret,
      ttlSeconds: 300,
      now: () => now,
    });
    const issued = await issuer.issue({ participantId, sessionId });
    const expiredVerifier = createGuestTokenService({
      secret,
      ttlSeconds: 300,
      now: () => new Date("2026-09-21T12:05:01.000Z"),
    });

    await expect(expiredVerifier.verify(issued.token)).resolves.toBeNull();
    await expect(
      issuer.verify(`${issued.token.slice(0, -1)}x`),
    ).resolves.toBeNull();
    await expect(issuer.verify("x".repeat(5_000))).resolves.toBeNull();
    await expect(
      issuer.verify(issued.token, {
        sessionId: "30000000-0000-4000-8000-000000000002",
      }),
    ).resolves.toBeNull();
    await expect(
      issuer.verify(issued.token, {
        participantId: "50000000-0000-4000-8000-000000000002",
      }),
    ).resolves.toBeNull();
  });

  it("rejects tokens signed with another secret or algorithm", async () => {
    const service = createGuestTokenService({
      secret,
      ttlSeconds: 900,
      now: () => now,
    });
    const otherService = createGuestTokenService({
      secret: "another-guest-token-secret-at-least-32-characters",
      ttlSeconds: 900,
      now: () => now,
    });
    const issued = await otherService.issue({ participantId, sessionId });
    const hs384Token = await new SignJWT({
      participantId,
      sessionId,
      role: "candidate",
    })
      .setProtectedHeader({ alg: "HS384", typ: "JWT" })
      .setIssuer("syncslate-api")
      .setAudience("syncslate-room")
      .setSubject(participantId)
      .setIssuedAt(Math.floor(now.getTime() / 1_000))
      .setExpirationTime(Math.floor(now.getTime() / 1_000) + 900)
      .sign(new TextEncoder().encode(secret));

    await expect(service.verify(issued.token)).resolves.toBeNull();
    await expect(service.verify(hs384Token)).resolves.toBeNull();
  });
});
