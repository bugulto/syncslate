import { describe, expect, it, vi } from "vitest";

import type { AccessTokenVerifier } from "../auth/access-token-verifier.js";
import type { GuestTokenVerifier } from "../auth/guest-token.js";
import { createRoomAuthenticator, isAllowedRoomOrigin } from "./room-auth.js";

const sessionId = "30000000-0000-4000-8000-000000000001";
const participantId = "50000000-0000-4000-8000-000000000001";
const userId = "550e8400-e29b-41d4-a716-446655440000";

function createAuthenticator(options?: {
  verifyAccessToken?: AccessTokenVerifier;
  verifyGuestToken?: GuestTokenVerifier;
  timeoutMs?: number;
}) {
  return createRoomAuthenticator({
    verifyAccessToken:
      options?.verifyAccessToken ?? vi.fn().mockResolvedValue(null),
    verifyGuestToken:
      options?.verifyGuestToken ?? vi.fn().mockResolvedValue(null),
    timeoutMs: options?.timeoutMs ?? 5_000,
  });
}

describe("room credential authentication", () => {
  it("normalizes a verified Supabase user principal", async () => {
    const verifyAccessToken = vi.fn().mockResolvedValue({
      principal: { kind: "user", userId },
      email: "interviewer@example.com",
      displayName: "Interviewer",
      avatarUrl: null,
    });
    const authenticate = createAuthenticator({ verifyAccessToken });

    await expect(
      authenticate({
        sessionId,
        credential: { kind: "user", accessToken: "supabase-token" },
      }),
    ).resolves.toEqual({
      kind: "authenticated",
      principal: { kind: "user", userId },
    });
    expect(verifyAccessToken).toHaveBeenCalledWith("supabase-token");
  });

  it("binds a verified guest principal to the requested session", async () => {
    const verifyGuestToken = vi.fn().mockResolvedValue({
      kind: "guest",
      participantId,
      sessionId,
      role: "candidate",
    });
    const authenticate = createAuthenticator({ verifyGuestToken });

    await expect(
      authenticate({
        sessionId,
        credential: { kind: "guest", token: "g".repeat(32) },
      }),
    ).resolves.toEqual({
      kind: "authenticated",
      principal: {
        kind: "guest",
        participantId,
        sessionId,
        role: "candidate",
      },
    });
    expect(verifyGuestToken).toHaveBeenCalledWith("g".repeat(32), {
      sessionId,
    });
  });

  it("returns one safe result for rejected and failed verification", async () => {
    const rejected = createAuthenticator();
    const failed = createAuthenticator({
      verifyAccessToken: vi.fn().mockRejectedValue(new Error("provider down")),
    });

    await expect(
      rejected({
        sessionId,
        credential: { kind: "guest", token: "g".repeat(32) },
      }),
    ).resolves.toEqual({ kind: "invalid" });
    await expect(
      failed({
        sessionId,
        credential: { kind: "user", accessToken: "invalid" },
      }),
    ).resolves.toEqual({ kind: "invalid" });
  });

  it("bounds slow token verification", async () => {
    vi.useFakeTimers();
    try {
      const verifyAccessToken: AccessTokenVerifier = () =>
        new Promise<never>(() => undefined);
      const authenticate = createAuthenticator({
        verifyAccessToken,
        timeoutMs: 1_000,
      });
      const result = authenticate({
        sessionId,
        credential: { kind: "user", accessToken: "slow-token" },
      });

      await vi.advanceTimersByTimeAsync(1_000);
      await expect(result).resolves.toEqual({ kind: "timeout" });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("room WebSocket origins", () => {
  const allowedOrigins = [
    "http://localhost:3000",
    "https://syncslate.example.com",
  ];

  it.each([
    "http://localhost:3000",
    "https://syncslate.example.com",
    "https://syncslate.example.com/",
  ])("allows configured origin %s", (origin) => {
    expect(isAllowedRoomOrigin(origin, allowedOrigins)).toBe(true);
  });

  it.each([
    undefined,
    "not-a-url",
    "https://attacker.example.com",
    "http://syncslate.example.com",
  ])("rejects missing or untrusted origin %s", (origin) => {
    expect(isAllowedRoomOrigin(origin, allowedOrigins)).toBe(false);
  });
});
