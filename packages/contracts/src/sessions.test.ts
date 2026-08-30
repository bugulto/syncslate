import { describe, expect, it } from "vitest";

import {
  createSessionRequestSchema,
  createSessionResponseSchema,
  getSessionResponseSchema,
  listSessionsResponseSchema,
  sessionDetailSchema,
  sessionSummarySchema,
} from "./sessions.js";

const problemSummary = {
  id: "550e8400-e29b-41d4-a716-446655440001",
  title: "Two Sum",
  slug: "two-sum",
  difficulty: "easy" as const,
  tags: ["arrays"],
  visibility: "seeded" as const,
  availableLanguages: ["typescript"] as const,
};

const problemDetail = {
  ...problemSummary,
  availableLanguages: ["typescript"] as "typescript"[],
  descriptionMarkdown: "Find two numbers that add up to the target.",
  constraintsMarkdown: null,
  examples: [
    {
      input: "nums = [2, 7], target = 9",
      output: "[0, 1]",
      explanation: null,
    },
  ],
  interviewerNotesMarkdown: null,
  starterCode: [
    {
      language: "typescript" as const,
      code: "function twoSum(nums: number[], target: number): number[] {}",
    },
  ],
  createdAt: "2026-08-31T10:00:00.000Z",
  updatedAt: "2026-08-31T10:00:00.000Z",
};

const validSessionSummary = {
  id: "550e8400-e29b-41d4-a716-446655440002",
  title: "Backend interview",
  status: "waiting" as const,
  language: "typescript" as const,
  editingPolicy: "candidate_only" as const,
  durationSeconds: 45 * 60,
  problem: problemSummary,
  createdAt: "2026-08-31T11:00:00.000Z",
  updatedAt: "2026-08-31T11:00:00.000Z",
};

const validSessionDetail = {
  ...validSessionSummary,
  problem: problemDetail,
  startedAt: null,
  endedAt: null,
};

describe("createSessionRequestSchema", () => {
  it("accepts and normalizes valid creation input", () => {
    expect(
      createSessionRequestSchema.parse({
        title: "  Backend interview  ",
        problemId: problemSummary.id,
        language: "typescript",
        durationSeconds: 2700,
      }),
    ).toEqual({
      title: "Backend interview",
      problemId: problemSummary.id,
      language: "typescript",
      durationSeconds: 2700,
    });
  });

  it("rejects invalid problem, language, and duration values", () => {
    expect(
      createSessionRequestSchema.safeParse({
        title: "Backend interview",
        problemId: "not-a-uuid",
        language: "ruby",
        durationSeconds: 60,
      }).success,
    ).toBe(false);
  });

  it("prevents clients from injecting ownership or lifecycle state", () => {
    expect(
      createSessionRequestSchema.safeParse({
        title: "Backend interview",
        problemId: problemSummary.id,
        language: "typescript",
        durationSeconds: 2700,
        interviewerId: "550e8400-e29b-41d4-a716-446655440099",
        status: "active",
        editingPolicy: "collaborative",
      }).success,
    ).toBe(false);
  });
});

describe("session response contracts", () => {
  it("accepts valid summary and detail payloads", () => {
    expect(sessionSummarySchema.parse(validSessionSummary)).toEqual(
      validSessionSummary,
    );
    expect(sessionDetailSchema.parse(validSessionDetail)).toEqual(
      validSessionDetail,
    );
  });

  it("allows a session without an assigned problem", () => {
    expect(
      sessionDetailSchema.safeParse({
        ...validSessionDetail,
        problem: null,
      }).success,
    ).toBe(true);
  });

  it("rejects unexpected sensitive fields", () => {
    expect(
      sessionDetailSchema.safeParse({
        ...validSessionDetail,
        interviewerId: "550e8400-e29b-41d4-a716-446655440099",
      }).success,
    ).toBe(false);
  });

  it("validates create, list, and detail response envelopes", () => {
    expect(
      createSessionResponseSchema.parse({ session: validSessionDetail }),
    ).toEqual({ session: validSessionDetail });
    expect(
      listSessionsResponseSchema.parse({ sessions: [validSessionSummary] }),
    ).toEqual({ sessions: [validSessionSummary] });
    expect(
      getSessionResponseSchema.parse({ session: validSessionDetail }),
    ).toEqual({ session: validSessionDetail });
  });
});
