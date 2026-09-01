import type {
  ListProblemsQuery,
  ProblemDetail,
  ProblemSummary,
} from "@syncslate/contracts";
import {
  and,
  arrayContains,
  asc,
  eq,
  ilike,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import type { DatabaseClient } from "../client.js";
import { problemStarterCode, problems } from "../schema.js";

export type SearchVisibleProblemsInput = ListProblemsQuery & {
  requesterId: string;
};

export type SearchVisibleProblemsResult = ProblemSummary[];

export type FindVisibleProblemByIdInput = {
  requesterId: string;
  problemId: string;
};

export type FindVisibleProblemByIdResult = ProblemDetail | null;

function visibleProblemCondition(requesterId: string): SQL {
  return or(
    eq(problems.visibility, "seeded"),
    and(eq(problems.visibility, "private"), eq(problems.ownerId, requesterId)),
  )!;
}

export async function searchVisibleProblems(
  client: DatabaseClient,
  input: SearchVisibleProblemsInput,
): Promise<SearchVisibleProblemsResult> {
  const conditions: SQL[] = [visibleProblemCondition(input.requesterId)];

  if (input.q !== undefined) {
    const searchPattern = `%${input.q}%`;
    const searchCondition = or(
      ilike(problems.title, searchPattern),
      ilike(problems.slug, searchPattern),
    );

    conditions.push(searchCondition!);
  }

  if (input.difficulty !== undefined) {
    conditions.push(eq(problems.difficulty, input.difficulty));
  }

  if (input.tag !== undefined) {
    conditions.push(arrayContains(problems.tags, [input.tag]));
  }

  return client.db
    .select({
      id: problems.id,
      title: problems.title,
      slug: problems.slug,
      difficulty: problems.difficulty,
      tags: problems.tags,
      visibility: problems.visibility,
      availableLanguages: sql<ProblemSummary["availableLanguages"]>`array_agg(
        distinct ${problemStarterCode.language}
        order by ${problemStarterCode.language}
      )`,
    })
    .from(problems)
    .innerJoin(
      problemStarterCode,
      eq(problemStarterCode.problemId, problems.id),
    )
    .where(and(...conditions))
    .groupBy(problems.id)
    .having(
      input.language === undefined
        ? undefined
        : sql<boolean>`bool_or(${problemStarterCode.language} = ${input.language})`,
    )
    .orderBy(asc(problems.title), asc(problems.id));
}

export async function findVisibleProblemById(
  client: DatabaseClient,
  input: FindVisibleProblemByIdInput,
): Promise<FindVisibleProblemByIdResult> {
  const rows = await client.db
    .select({
      problem: {
        id: problems.id,
        title: problems.title,
        slug: problems.slug,
        difficulty: problems.difficulty,
        tags: problems.tags,
        visibility: problems.visibility,
        descriptionMarkdown: problems.descriptionMarkdown,
        constraintsMarkdown: problems.constraintsMarkdown,
        examples: problems.examples,
        interviewerNotesMarkdown: problems.interviewerNotesMarkdown,
        createdAt: problems.createdAt,
        updatedAt: problems.updatedAt,
      },
      starterCode: {
        language: problemStarterCode.language,
        code: problemStarterCode.code,
      },
    })
    .from(problems)
    .innerJoin(
      problemStarterCode,
      eq(problemStarterCode.problemId, problems.id),
    )
    .where(
      and(
        eq(problems.id, input.problemId),
        visibleProblemCondition(input.requesterId),
      ),
    )
    .orderBy(asc(problemStarterCode.language));

  const firstRow = rows[0];

  if (firstRow === undefined) {
    return null;
  }

  const starterCode = rows.map((row) => row.starterCode);

  return {
    ...firstRow.problem,
    availableLanguages: starterCode.map((entry) => entry.language),
    starterCode,
    createdAt: firstRow.problem.createdAt.toISOString(),
    updatedAt: firstRow.problem.updatedAt.toISOString(),
  };
}
