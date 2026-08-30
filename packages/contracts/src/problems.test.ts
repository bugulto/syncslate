import { describe, expect, it } from "vitest";

import {
  getProblemResponseSchema,
  listProblemsQuerySchema,
  listProblemsResponseSchema,
  problemDetailSchema,
  problemExampleSchema,
  problemSummarySchema,
} from "./problems.js";

const validProblemSummary = {
  id: "550e8400-e29b-41d4-a716-446655440001",
  title: "Two Sum",
  slug: "two-sum",
  difficulty: "easy" as const,
  tags: ["arrays", "hash map"],
  visibility: "seeded" as const,
  availableLanguages: ["typescript", "python"] as const,
};

const validProblemDetail = {
  ...validProblemSummary,
  availableLanguages: ["typescript", "python"] as ("typescript" | "python")[],
  descriptionMarkdown: "Find two numbers that add up to the target.",
  constraintsMarkdown: "- At least two values are provided.",
  examples: [
    {
      input: "nums = [2, 7, 11, 15], target = 9",
      output: "[0, 1]",
      explanation: "The values at indexes 0 and 1 add up to 9.",
    },
  ],
  interviewerNotesMarkdown: "Ask about time and space complexity.",
  starterCode: [
    {
      language: "typescript" as const,
      code: "function twoSum(nums: number[], target: number): number[] {}",
    },
    {
      language: "python" as const,
      code: "def two_sum(nums, target):\n    pass",
    },
  ],
  createdAt: "2026-08-31T10:00:00.000Z",
  updatedAt: "2026-08-31T10:00:00.000Z",
};

describe("problemExampleSchema", () => {
  it("accepts a structured problem example", () => {
    expect(problemExampleSchema.parse(validProblemDetail.examples[0])).toEqual(
      validProblemDetail.examples[0],
    );
  });

  it("rejects empty values and unknown fields", () => {
    expect(
      problemExampleSchema.safeParse({
        input: "",
        output: "[0, 1]",
        explanation: null,
      }).success,
    ).toBe(false);
    expect(
      problemExampleSchema.safeParse({
        ...validProblemDetail.examples[0],
        hiddenHint: "Use a map",
      }).success,
    ).toBe(false);
  });
});

describe("problem schemas", () => {
  it("accepts valid summary and detail payloads", () => {
    expect(problemSummarySchema.parse(validProblemSummary)).toEqual(
      validProblemSummary,
    );
    expect(problemDetailSchema.parse(validProblemDetail)).toEqual(
      validProblemDetail,
    );
  });

  it("requires URL-safe slugs and unique languages", () => {
    expect(
      problemSummarySchema.safeParse({
        ...validProblemSummary,
        slug: "Two Sum",
      }).success,
    ).toBe(false);
    expect(
      problemSummarySchema.safeParse({
        ...validProblemSummary,
        availableLanguages: ["python", "python"],
      }).success,
    ).toBe(false);
  });

  it("requires available languages to match starter code", () => {
    expect(
      problemDetailSchema.safeParse({
        ...validProblemDetail,
        availableLanguages: ["typescript"],
      }).success,
    ).toBe(false);
  });

  it("rejects unexpected fields", () => {
    expect(
      problemDetailSchema.safeParse({
        ...validProblemDetail,
        solutionMarkdown: "Private solution",
      }).success,
    ).toBe(false);
  });
});

describe("problem endpoint contracts", () => {
  it("accepts supported list filters and trims text", () => {
    expect(
      listProblemsQuerySchema.parse({
        q: "  sum  ",
        difficulty: "easy",
        tag: " arrays ",
        language: "typescript",
      }),
    ).toEqual({
      q: "sum",
      difficulty: "easy",
      tag: "arrays",
      language: "typescript",
    });
  });

  it("rejects malformed or unknown filters", () => {
    expect(
      listProblemsQuerySchema.safeParse({ difficulty: "expert" }).success,
    ).toBe(false);
    expect(listProblemsQuerySchema.safeParse({ ownerId: "me" }).success).toBe(
      false,
    );
  });

  it("validates list and detail response envelopes", () => {
    expect(
      listProblemsResponseSchema.parse({ problems: [validProblemSummary] }),
    ).toEqual({ problems: [validProblemSummary] });
    expect(
      getProblemResponseSchema.parse({ problem: validProblemDetail }),
    ).toEqual({ problem: validProblemDetail });
  });
});
