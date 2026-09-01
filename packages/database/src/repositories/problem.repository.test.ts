import type { ProblemSummary } from "@syncslate/contracts";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

import type { DatabaseClient } from "../client.js";
import {
  findVisibleProblemById,
  searchVisibleProblems,
} from "./problem.repository.js";

const requesterId = "550e8400-e29b-41d4-a716-446655440000";
const problemId = "10000000-0000-4000-8000-000000000001";

function createFakeClient(rows: unknown[]) {
  const query = {
    from: vi.fn(),
    innerJoin: vi.fn(),
    where: vi.fn(),
    groupBy: vi.fn(),
    having: vi.fn(),
    orderBy: vi.fn(async () => rows),
  };

  query.from.mockReturnValue(query);
  query.innerJoin.mockReturnValue(query);
  query.where.mockReturnValue(query);
  query.groupBy.mockReturnValue(query);
  query.having.mockReturnValue(query);

  const db = {
    select: vi.fn(() => query),
  };

  return {
    client: { db, close: vi.fn() } as unknown as DatabaseClient,
    query,
  };
}

function compileSql(expression: unknown) {
  return new PgDialect().sqlToQuery(expression as SQL);
}

describe("problem repository", () => {
  describe("searchVisibleProblems", () => {
    it("returns summaries from the query", async () => {
      const summaries: ProblemSummary[] = [
        {
          id: problemId,
          title: "Two Sum",
          slug: "two-sum",
          difficulty: "easy",
          tags: ["arrays", "hash map"],
          visibility: "seeded",
          availableLanguages: ["typescript", "javascript", "python"],
        },
      ];
      const { client } = createFakeClient(summaries);

      await expect(
        searchVisibleProblems(client, { requesterId }),
      ).resolves.toEqual(summaries);
    });

    it("scopes results to seeded and requester-owned private problems", async () => {
      const { client, query } = createFakeClient([]);

      await searchVisibleProblems(client, { requesterId });

      const where = compileSql(query.where.mock.calls[0]?.[0]);
      expect(where.sql).toContain('"problems"."visibility" = $1');
      expect(where.sql).toContain('"problems"."owner_id" = $3');
      expect(where.params).toEqual(["seeded", "private", requesterId]);
    });

    it("adds text, difficulty, tag, and language filters", async () => {
      const { client, query } = createFakeClient([]);

      await searchVisibleProblems(client, {
        requesterId,
        q: "sum",
        difficulty: "easy",
        tag: "arrays",
        language: "python",
      });

      const where = compileSql(query.where.mock.calls[0]?.[0]);
      expect(where.sql).toContain('"problems"."title" ilike');
      expect(where.sql).toContain('"problems"."slug" ilike');
      expect(where.sql).toContain('"problems"."difficulty" =');
      expect(where.sql).toContain('"problems"."tags" @>');
      expect(where.params).toEqual(
        expect.arrayContaining([requesterId, "%sum%", "easy"]),
      );

      const having = compileSql(query.having.mock.calls[0]?.[0]);
      expect(having.sql).toContain("bool_or");
      expect(having.params).toEqual(["python"]);
    });
  });

  describe("findVisibleProblemById", () => {
    it("returns null when the problem is missing or inaccessible", async () => {
      const { client } = createFakeClient([]);

      await expect(
        findVisibleProblemById(client, { requesterId, problemId }),
      ).resolves.toBeNull();
    });

    it("maps the problem and all starter code to contract-compatible detail", async () => {
      const createdAt = new Date("2026-08-17T00:00:00.000Z");
      const updatedAt = new Date("2026-08-18T00:00:00.000Z");
      const problem = {
        id: problemId,
        title: "Two Sum",
        slug: "two-sum",
        difficulty: "easy" as const,
        tags: ["arrays", "hash map"],
        visibility: "seeded" as const,
        descriptionMarkdown: "Find two values.",
        constraintsMarkdown: null,
        examples: [],
        interviewerNotesMarkdown: null,
        createdAt,
        updatedAt,
      };
      const rows = [
        {
          problem,
          starterCode: { language: "typescript" as const, code: "code one" },
        },
        {
          problem,
          starterCode: { language: "python" as const, code: "code two" },
        },
      ];
      const { client } = createFakeClient(rows);

      await expect(
        findVisibleProblemById(client, { requesterId, problemId }),
      ).resolves.toEqual({
        ...problem,
        availableLanguages: ["typescript", "python"],
        starterCode: rows.map((row) => row.starterCode),
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
      });
    });

    it("scopes detail lookup by problem and requester visibility", async () => {
      const { client, query } = createFakeClient([]);

      await findVisibleProblemById(client, { requesterId, problemId });

      const where = compileSql(query.where.mock.calls[0]?.[0]);
      expect(where.sql).toContain('"problems"."id" = $1');
      expect(where.sql).toContain('"problems"."owner_id" = $4');
      expect(where.params).toEqual([
        problemId,
        "seeded",
        "private",
        requesterId,
      ]);
    });
  });
});
