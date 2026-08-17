import { describe, expect, it } from "vitest";

import { signInSchema, signUpSchema } from "./auth.schema";

describe("signInSchema", () => {
  it("accepts valid credentials and normalizes the email", () => {
    expect(
      signInSchema.parse({
        email: "  interviewer@example.com  ",
        password: "secure-password",
      }),
    ).toEqual({
      email: "interviewer@example.com",
      password: "secure-password",
    });
  });

  it("rejects an invalid email", () => {
    expect(
      signInSchema.safeParse({
        email: "not-an-email",
        password: "secure-password",
      }).success,
    ).toBe(false);
  });

  it("rejects a password shorter than eight characters", () => {
    expect(
      signInSchema.safeParse({
        email: "interviewer@example.com",
        password: "short",
      }).success,
    ).toBe(false);
  });
});

describe("signUpSchema", () => {
  const validSignUp = {
    displayName: "Ada Lovelace",
    email: "ada@example.com",
    password: "secure-password",
    confirmPassword: "secure-password",
  };

  it("accepts valid registration details", () => {
    expect(signUpSchema.parse(validSignUp)).toEqual(validSignUp);
  });

  it("trims the display name", () => {
    expect(
      signUpSchema.parse({
        ...validSignUp,
        displayName: "  Ada Lovelace  ",
      }).displayName,
    ).toBe("Ada Lovelace");
  });

  it("rejects an empty display name", () => {
    expect(
      signUpSchema.safeParse({
        ...validSignUp,
        displayName: "   ",
      }).success,
    ).toBe(false);
  });

  it("rejects an invalid email", () => {
    expect(
      signUpSchema.safeParse({
        ...validSignUp,
        email: "not-an-email",
      }).success,
    ).toBe(false);
  });

  it("rejects a password shorter than eight characters", () => {
    expect(
      signUpSchema.safeParse({
        ...validSignUp,
        password: "short",
        confirmPassword: "short",
      }).success,
    ).toBe(false);
  });

  it("reports mismatched passwords against the confirmation field", () => {
    const result = signUpSchema.safeParse({
      ...validSignUp,
      confirmPassword: "different-password",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: "Passwords do not match",
            path: ["confirmPassword"],
          }),
        ]),
      );
    }
  });
});
