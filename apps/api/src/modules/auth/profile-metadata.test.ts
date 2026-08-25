import { describe, expect, it } from "vitest";

import type { AuthenticatedUser } from "./authenticated-user.js";
import { resolveProfileMetadata } from "./profile-metadata.js";

const authenticatedUser: AuthenticatedUser = {
  principal: {
    kind: "user",
    userId: "550e8400-e29b-41d4-a716-446655440000",
  },
  email: "ada.lovelace@example.com",
  displayName: "Ada Lovelace",
  avatarUrl: "https://example.com/avatar.png",
};

describe("resolveProfileMetadata", () => {
  it("prefers the verified Supabase display name", () => {
    expect(resolveProfileMetadata(authenticatedUser)).toEqual({
      displayName: "Ada Lovelace",
      avatarUrl: "https://example.com/avatar.png",
    });
  });

  it("derives a display name from the email prefix", () => {
    expect(
      resolveProfileMetadata({
        ...authenticatedUser,
        displayName: null,
      }).displayName,
    ).toBe("ada lovelace");
  });

  it("removes email tags and normalizes separators", () => {
    expect(
      resolveProfileMetadata({
        ...authenticatedUser,
        email: "ada_grace-lovelace+interviews@example.com",
        displayName: null,
      }).displayName,
    ).toBe("ada grace lovelace");
  });

  it("truncates a long email-derived display name", () => {
    expect(
      resolveProfileMetadata({
        ...authenticatedUser,
        email: "averylonginterviewername@example.com",
        displayName: null,
      }).displayName,
    ).toBe("averylonginterviewer");
  });

  it("uses the fallback for an unusably short email prefix", () => {
    expect(
      resolveProfileMetadata({
        ...authenticatedUser,
        email: "ab@example.com",
        displayName: null,
      }).displayName,
    ).toBe("Interviewer");
  });

  it("uses the fallback when display name and email are missing", () => {
    expect(
      resolveProfileMetadata({
        ...authenticatedUser,
        email: null,
        displayName: null,
      }).displayName,
    ).toBe("Interviewer");
  });

  it("uses the email fallback when a supplied display name is invalid", () => {
    expect(
      resolveProfileMetadata({
        ...authenticatedUser,
        displayName: "Al",
      }).displayName,
    ).toBe("ada lovelace");
  });

  it("preserves a missing avatar as null", () => {
    expect(
      resolveProfileMetadata({
        ...authenticatedUser,
        avatarUrl: null,
      }).avatarUrl,
    ).toBeNull();
  });
});
