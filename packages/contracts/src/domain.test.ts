import { describe, expect, it } from "vitest";

import {
  editingPolicyValues,
  editingPolicySchema,
  problemDifficultyValues,
  problemDifficultySchema,
  problemVisibilityValues,
  problemVisibilitySchema,
  sessionStatusValues,
  sessionStatusSchema,
  supportedLanguageValues,
  supportedLanguageSchema,
} from "./domain.js";

describe("problem domain enums", () => {
  it.each(problemVisibilityValues)(
    "accepts the %s visibility",
    (visibility) => {
      expect(problemVisibilitySchema.parse(visibility)).toBe(visibility);
    },
  );

  it.each(problemDifficultyValues)(
    "accepts the %s difficulty",
    (difficulty) => {
      expect(problemDifficultySchema.parse(difficulty)).toBe(difficulty);
    },
  );

  it("rejects unsupported problem values", () => {
    expect(problemVisibilitySchema.safeParse("public").success).toBe(false);
    expect(problemDifficultySchema.safeParse("expert").success).toBe(false);
  });
});

describe("session domain enums", () => {
  it.each(supportedLanguageValues)("accepts the %s language", (language) => {
    expect(supportedLanguageSchema.parse(language)).toBe(language);
  });

  it.each(sessionStatusValues)("accepts the %s session status", (status) => {
    expect(sessionStatusSchema.parse(status)).toBe(status);
  });

  it.each(editingPolicyValues)("accepts the %s editing policy", (policy) => {
    expect(editingPolicySchema.parse(policy)).toBe(policy);
  });

  it("rejects unsupported session values", () => {
    expect(supportedLanguageSchema.safeParse("ruby").success).toBe(false);
    expect(sessionStatusSchema.safeParse("finished").success).toBe(false);
    expect(editingPolicySchema.safeParse("read_only").success).toBe(false);
  });
});
