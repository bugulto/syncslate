import { describe, expect, it } from "vitest";

import { currentUserSchema, meResponseSchema } from "./auth.js";

const validUser = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  email: "interviewer@example.com",
  displayName: "Ada Lovelace",
  avatarUrl: "https://example.com/avatar.png",
};

describe("currentUserSchema", () => {
  it("accepts a valid current user", () => {
    expect(currentUserSchema.parse(validUser)).toEqual(validUser);
  });

  it("accepts nullable provider fields", () => {
    expect(
      currentUserSchema.parse({
        ...validUser,
        email: null,
        avatarUrl: null,
      }),
    ).toEqual({
      ...validUser,
      email: null,
      avatarUrl: null,
    });
  });

  it("rejects malformed identity fields", () => {
    expect(
      currentUserSchema.safeParse({
        ...validUser,
        id: "not-a-uuid",
        email: "not-an-email",
        avatarUrl: "not-a-url",
      }).success,
    ).toBe(false);
  });

  it("rejects a missing display name", () => {
    const userWithoutDisplayName = {
      id: validUser.id,
      email: validUser.email,
      avatarUrl: validUser.avatarUrl,
    };

    expect(currentUserSchema.safeParse(userWithoutDisplayName).success).toBe(
      false,
    );
  });

  it("rejects unexpected sensitive fields", () => {
    expect(
      currentUserSchema.safeParse({
        ...validUser,
        accessToken: "secret-token",
      }).success,
    ).toBe(false);
  });
});

describe("meResponseSchema", () => {
  it("accepts a valid current-user response", () => {
    const response = { user: validUser };

    expect(meResponseSchema.parse(response)).toEqual(response);
  });

  it("rejects a response without a user", () => {
    expect(meResponseSchema.safeParse({}).success).toBe(false);
  });

  it("rejects unexpected top-level fields", () => {
    expect(
      meResponseSchema.safeParse({
        user: validUser,
        refreshToken: "secret-token",
      }).success,
    ).toBe(false);
  });
});
