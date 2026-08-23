import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAccessTokenVerifier } from "./access-token-verifier.js";

const getUser = vi.fn();
const verifyAccessToken = createAccessTokenVerifier({ auth: { getUser } });

describe("createAccessTokenVerifier", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a normalized authenticated user for a verified user", async () => {
    getUser.mockResolvedValue({
      data: {
        user: {
          id: "550e8400-e29b-41d4-a716-446655440000",
          email: "interviewer@example.com",
          user_metadata: {
            display_name: "  Ada Lovelace  ",
            avatar_url: "https://example.com/avatar.png",
            provider_token: "must-not-escape",
          },
        },
      },
      error: null,
    });

    await expect(verifyAccessToken("valid-access-token")).resolves.toEqual({
      principal: {
        kind: "user",
        userId: "550e8400-e29b-41d4-a716-446655440000",
      },
      email: "interviewer@example.com",
      displayName: "Ada Lovelace",
      avatarUrl: "https://example.com/avatar.png",
    });
    expect(getUser).toHaveBeenCalledWith("valid-access-token");
  });

  it("normalizes absent optional user data to null", async () => {
    getUser.mockResolvedValue({
      data: {
        user: {
          id: "550e8400-e29b-41d4-a716-446655440000",
        },
      },
      error: null,
    });

    await expect(verifyAccessToken("valid-access-token")).resolves.toEqual({
      principal: {
        kind: "user",
        userId: "550e8400-e29b-41d4-a716-446655440000",
      },
      email: null,
      displayName: null,
      avatarUrl: null,
    });
  });

  it("discards invalid optional user data", async () => {
    getUser.mockResolvedValue({
      data: {
        user: {
          id: "550e8400-e29b-41d4-a716-446655440000",
          email: "not-an-email",
          user_metadata: {
            display_name: "Al",
            avatar_url: "not-a-url",
          },
        },
      },
      error: null,
    });

    await expect(verifyAccessToken("valid-access-token")).resolves.toEqual({
      principal: {
        kind: "user",
        userId: "550e8400-e29b-41d4-a716-446655440000",
      },
      email: null,
      displayName: null,
      avatarUrl: null,
    });
  });

  it("returns null when the verified user ID is malformed", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "not-a-uuid" } },
      error: null,
    });

    await expect(verifyAccessToken("invalid-user-token")).resolves.toBeNull();
  });

  it("returns null when Supabase rejects the token", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: new Error("token expired"),
    });

    await expect(verifyAccessToken("expired-token")).resolves.toBeNull();
  });

  it("returns null when verification has no user", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    await expect(verifyAccessToken("userless-token")).resolves.toBeNull();
  });

  it("returns null when Supabase verification throws", async () => {
    getUser.mockRejectedValue(new Error("Supabase unavailable"));

    await expect(verifyAccessToken("unverifiable-token")).resolves.toBeNull();
  });
});
