import { describe, expect, it } from "vitest";

import {
  parseSeededProblems,
  seededProblemsSchema,
} from "./problem-seed.schema.js";
import { seededProblems, validatedSeededProblems } from "./problems.js";

describe("seededProblemsSchema", () => {
  it("validates and freezes the built-in problem dataset", () => {
    expect(parseSeededProblems(seededProblems)).toEqual(seededProblems);
    expect(validatedSeededProblems).toEqual(seededProblems);
    expect(Object.isFrozen(validatedSeededProblems)).toBe(true);
  });

  it("rejects duplicate problem IDs", () => {
    const input = seededProblems.map((problem, index) =>
      index === 1 ? { ...problem, id: seededProblems[0].id } : problem,
    );

    expect(seededProblemsSchema.safeParse(input).success).toBe(false);
  });

  it("rejects duplicate problem slugs", () => {
    const input = seededProblems.map((problem, index) =>
      index === 1 ? { ...problem, slug: seededProblems[0].slug } : problem,
    );

    expect(seededProblemsSchema.safeParse(input).success).toBe(false);
  });

  it("rejects duplicate starter-code IDs across problems", () => {
    const input = seededProblems.map((problem, problemIndex) =>
      problemIndex === 1
        ? {
            ...problem,
            starterCode: problem.starterCode.map((starterCode, starterIndex) =>
              starterIndex === 0
                ? { ...starterCode, id: seededProblems[0].starterCode[0].id }
                : starterCode,
            ),
          }
        : problem,
    );

    expect(seededProblemsSchema.safeParse(input).success).toBe(false);
  });

  it("rejects duplicate languages within one problem", () => {
    const input = seededProblems.map((problem, problemIndex) =>
      problemIndex === 0
        ? {
            ...problem,
            starterCode: problem.starterCode.map((starterCode, starterIndex) =>
              starterIndex === 1
                ? {
                    ...starterCode,
                    language: problem.starterCode[0].language,
                  }
                : starterCode,
            ),
          }
        : problem,
    );

    expect(seededProblemsSchema.safeParse(input).success).toBe(false);
  });

  it("requires seeded ownership and rejects unknown fields", () => {
    expect(
      seededProblemsSchema.safeParse([
        {
          ...seededProblems[0],
          ownerId: "550e8400-e29b-41d4-a716-446655440000",
        },
      ]).success,
    ).toBe(false);
    expect(
      seededProblemsSchema.safeParse([
        { ...seededProblems[0], hiddenSolution: "Do not expose this" },
      ]).success,
    ).toBe(false);
  });
});
