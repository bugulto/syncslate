import { describe, expect, it } from "vitest";

import { supportedLanguageValues } from "@syncslate/contracts";

import { validatedSeededProblems } from "./problems.js";
import { createProblemSeedPlan } from "./seed-problems.js";

describe("createProblemSeedPlan", () => {
  it("maps every definition to a deterministic problem row", () => {
    const plan = createProblemSeedPlan();

    expect(plan.problemRows).toHaveLength(validatedSeededProblems.length);
    expect(plan.problemRows).toEqual(
      expect.arrayContaining(
        validatedSeededProblems.map((problem) =>
          expect.objectContaining({
            id: problem.id,
            ownerId: null,
            visibility: "seeded",
            slug: problem.slug,
          }),
        ),
      ),
    );
  });

  it("flattens starter code with its owning problem ID", () => {
    const plan = createProblemSeedPlan();
    const expectedStarterCodeCount = validatedSeededProblems.reduce(
      (count, problem) => count + problem.starterCode.length,
      0,
    );

    expect(plan.starterCodeRows).toHaveLength(expectedStarterCodeCount);

    for (const problem of validatedSeededProblems) {
      const problemStarterCode = plan.starterCodeRows.filter(
        (starterCode) => starterCode.problemId === problem.id,
      );

      expect(problemStarterCode.map((starterCode) => starterCode.id)).toEqual(
        problem.starterCode.map((starterCode) => starterCode.id),
      );
    }
  });

  it("scopes reconciliation to known problem IDs and expected languages", () => {
    const plan = createProblemSeedPlan();

    expect([...plan.languagesByProblemId.keys()]).toEqual(
      validatedSeededProblems.map((problem) => problem.id),
    );

    for (const languages of plan.languagesByProblemId.values()) {
      expect(languages).toEqual(supportedLanguageValues);
    }
  });
});
