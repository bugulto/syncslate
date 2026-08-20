import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAccessTokenVerifier } from "./access-token-verifier.js";

const getUser = vi.fn();
const verifyAccessToken = createAccessTokenVerifier({ auth: { getUser } });

describe("createAccessTokenVerifier", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a normalized principal for a verified user", async () => {
    getUser.mockResolvedValue({
      data: {
        user: {
          id: "550e8400-e29b-41d4-a716-446655440000",
          email: "interviewer@example.com",
          user_metadata: { display_name: "Ada Lovelace" },
        },
      },
      error: null,
    });

    await expect(verifyAccessToken("valid-access-token")).resolves.toEqual({
      kind: "user",
      userId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(getUser).toHaveBeenCalledWith("valid-access-token");
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
