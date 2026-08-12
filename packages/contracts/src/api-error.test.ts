import { describe, expect, it } from "vitest";

import { apiErrorCodeSchema, apiErrorSchema } from "./api-error.js";

const validApiError = {
  error: {
    code: "UNAUTHORIZED" as const,
    message: "Authentication is required",
    requestId: "req-1",
  },
};

describe("apiErrorCodeSchema", () => {
  it.each([
    "UNAUTHORIZED",
    "FORBIDDEN",
    "VALIDATION_ERROR",
    "INTERNAL_SERVER_ERROR",
  ])("accepts the %s error code", (code) => {
    expect(apiErrorCodeSchema.parse(code)).toBe(code);
  });

  it("rejects an unknown error code", () => {
    expect(apiErrorCodeSchema.safeParse("TOKEN_EXPIRED").success).toBe(false);
  });
});

describe("apiErrorSchema", () => {
  it("accepts a valid API error", () => {
    expect(apiErrorSchema.parse(validApiError)).toEqual(validApiError);
  });

  it("accepts safe structured details", () => {
    const errorWithDetails = {
      ...validApiError,
      error: {
        ...validApiError.error,
        details: {
          fields: [{ path: "email", message: "Invalid email address" }],
        },
      },
    };

    expect(apiErrorSchema.parse(errorWithDetails)).toEqual(errorWithDetails);
  });

  it.each(["code", "message", "requestId"])(
    "rejects an error without %s",
    (field) => {
      const incompleteError = {
        error: Object.fromEntries(
          Object.entries(validApiError.error).filter(([key]) => key !== field),
        ),
      };

      expect(apiErrorSchema.safeParse(incompleteError).success).toBe(false);
    },
  );

  it("rejects blank messages and request IDs", () => {
    expect(
      apiErrorSchema.safeParse({
        error: {
          ...validApiError.error,
          message: "  ",
          requestId: "  ",
        },
      }).success,
    ).toBe(false);
  });

  it("rejects unexpected nested fields", () => {
    expect(
      apiErrorSchema.safeParse({
        error: {
          ...validApiError.error,
          stack: "sensitive stack trace",
        },
      }).success,
    ).toBe(false);
  });

  it("rejects unexpected top-level fields", () => {
    expect(
      apiErrorSchema.safeParse({
        ...validApiError,
        debug: true,
      }).success,
    ).toBe(false);
  });
});
