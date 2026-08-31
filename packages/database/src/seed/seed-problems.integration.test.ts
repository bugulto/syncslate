import { inArray, notInArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabaseClient, type DatabaseClient } from "../client.js";
import { problems, problemStarterCode } from "../schema.js";
import { validatedSeededProblems } from "./problems.js";
import { seedProblems } from "./seed-problems.js";

class RollbackIntegrationTest extends Error {}

describe("seedProblems integration", () => {
  let client: DatabaseClient;

  beforeAll(() => {
    const directDatabaseUrl = process.env.DIRECT_DATABASE_URL?.trim();

    client = createDatabaseClient({
      connectionString: directDatabaseUrl || process.env.DATABASE_URL,
      maxConnections: 1,
    });
  });

  afterAll(async () => {
    await client.close();
  });

  it("is idempotent and leaves unrelated problems untouched", async () => {
    const problemIds = validatedSeededProblems.map((problem) => problem.id);
    const expectedStarterCodeCount = validatedSeededProblems.reduce(
      (count, problem) => count + problem.starterCode.length,
      0,
    );

    try {
      await client.db.transaction(async (transaction) => {
        const unrelatedProblemsBefore = await transaction
          .select()
          .from(problems)
          .where(notInArray(problems.id, problemIds))
          .orderBy(problems.id);

        const firstResult = await seedProblems(transaction);
        const problemsAfterFirstRun = await transaction
          .select()
          .from(problems)
          .where(inArray(problems.id, problemIds))
          .orderBy(problems.id);
        const starterCodeAfterFirstRun = await transaction
          .select()
          .from(problemStarterCode)
          .where(inArray(problemStarterCode.problemId, problemIds))
          .orderBy(problemStarterCode.id);

        const secondResult = await seedProblems(transaction);
        const problemsAfterSecondRun = await transaction
          .select()
          .from(problems)
          .where(inArray(problems.id, problemIds))
          .orderBy(problems.id);
        const starterCodeAfterSecondRun = await transaction
          .select()
          .from(problemStarterCode)
          .where(inArray(problemStarterCode.problemId, problemIds))
          .orderBy(problemStarterCode.id);
        const unrelatedProblemsAfter = await transaction
          .select()
          .from(problems)
          .where(notInArray(problems.id, problemIds))
          .orderBy(problems.id);

        expect(firstResult).toEqual({
          problemCount: validatedSeededProblems.length,
          starterCodeCount: expectedStarterCodeCount,
        });
        expect(secondResult).toEqual(firstResult);
        expect(problemsAfterFirstRun).toHaveLength(
          validatedSeededProblems.length,
        );
        expect(starterCodeAfterFirstRun).toHaveLength(expectedStarterCodeCount);
        expect(problemsAfterSecondRun).toEqual(problemsAfterFirstRun);
        expect(starterCodeAfterSecondRun).toEqual(starterCodeAfterFirstRun);
        expect(unrelatedProblemsAfter).toEqual(unrelatedProblemsBefore);

        throw new RollbackIntegrationTest();
      });
    } catch (error) {
      if (!(error instanceof RollbackIntegrationTest)) {
        throw error;
      }
    }
  });
});
