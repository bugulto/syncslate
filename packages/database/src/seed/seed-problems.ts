import type { SupportedLanguage } from "@syncslate/contracts";
import { and, eq, inArray, notInArray, sql } from "drizzle-orm";

import type { Database } from "../client.js";
import {
  type NewProblem,
  type NewProblemStarterCode,
  problems,
  problemStarterCode,
} from "../schema.js";
import type { SeededProblems } from "./problem-seed.schema.js";
import { validatedSeededProblems } from "./problems.js";

export type SeedResult = {
  problemCount: number;
  starterCodeCount: number;
};

type SeedDatabase = Pick<Database, "transaction">;

type ProblemSeedPlan = {
  problemRows: ProblemSeedRow[];
  starterCodeRows: StarterCodeSeedRow[];
  languagesByProblemId: ReadonlyMap<string, readonly SupportedLanguage[]>;
};

type ProblemSeedRow = NewProblem & { id: string };
type StarterCodeSeedRow = NewProblemStarterCode & {
  id: string;
  problemId: string;
  language: SupportedLanguage;
};

export function createProblemSeedPlan(
  definitions: SeededProblems = validatedSeededProblems,
): ProblemSeedPlan {
  const problemRows = definitions.map((problem): ProblemSeedRow => ({
    id: problem.id,
    ownerId: problem.ownerId,
    visibility: problem.visibility,
    title: problem.title,
    slug: problem.slug,
    descriptionMarkdown: problem.descriptionMarkdown,
    difficulty: problem.difficulty,
    tags: [...problem.tags],
    constraintsMarkdown: problem.constraintsMarkdown,
    examples: problem.examples.map((example) => ({ ...example })),
    interviewerNotesMarkdown: problem.interviewerNotesMarkdown,
  }));

  const starterCodeRows = definitions.flatMap((problem) =>
    problem.starterCode.map((starterCode): StarterCodeSeedRow => ({
      id: starterCode.id,
      problemId: problem.id,
      language: starterCode.language,
      code: starterCode.code,
    })),
  );

  const languagesByProblemId = new Map<string, readonly SupportedLanguage[]>(
    definitions.map((problem) => [
      problem.id,
      problem.starterCode.map((starterCode) => starterCode.language),
    ]),
  );

  return {
    problemRows,
    starterCodeRows,
    languagesByProblemId,
  };
}

export async function seedProblems(db: SeedDatabase): Promise<SeedResult> {
  const plan = createProblemSeedPlan();
  const problemIds = plan.problemRows.map((problem) => problem.id);

  return db.transaction(async (transaction) => {
    const privateIdCollisions = await transaction
      .select({ id: problems.id })
      .from(problems)
      .where(
        and(
          inArray(problems.id, problemIds),
          eq(problems.visibility, "private"),
        ),
      );

    if (privateIdCollisions.length > 0) {
      throw new Error(
        "Cannot seed problems because a deterministic seed ID belongs to a private problem",
      );
    }

    await transaction
      .insert(problems)
      .values(plan.problemRows)
      .onConflictDoUpdate({
        target: problems.id,
        set: {
          ownerId: sql`excluded.owner_id`,
          visibility: sql`excluded.visibility`,
          title: sql`excluded.title`,
          slug: sql`excluded.slug`,
          descriptionMarkdown: sql`excluded.description_markdown`,
          difficulty: sql`excluded.difficulty`,
          tags: sql`excluded.tags`,
          constraintsMarkdown: sql`excluded.constraints_markdown`,
          examples: sql`excluded.examples`,
          interviewerNotesMarkdown: sql`excluded.interviewer_notes_markdown`,
          updatedAt: sql`now()`,
        },
        setWhere: sql`
          ${problems.ownerId} is distinct from excluded.owner_id
          or ${problems.visibility} is distinct from excluded.visibility
          or ${problems.title} is distinct from excluded.title
          or ${problems.slug} is distinct from excluded.slug
          or ${problems.descriptionMarkdown} is distinct from excluded.description_markdown
          or ${problems.difficulty} is distinct from excluded.difficulty
          or ${problems.tags} is distinct from excluded.tags
          or ${problems.constraintsMarkdown} is distinct from excluded.constraints_markdown
          or ${problems.examples} is distinct from excluded.examples
          or ${problems.interviewerNotesMarkdown} is distinct from excluded.interviewer_notes_markdown
        `,
      });

    for (const [problemId, expectedLanguages] of plan.languagesByProblemId) {
      await transaction
        .delete(problemStarterCode)
        .where(
          and(
            eq(problemStarterCode.problemId, problemId),
            notInArray(problemStarterCode.language, [...expectedLanguages]),
          ),
        );
    }

    await transaction
      .insert(problemStarterCode)
      .values(plan.starterCodeRows)
      .onConflictDoUpdate({
        target: [problemStarterCode.problemId, problemStarterCode.language],
        set: {
          id: sql`excluded.id`,
          code: sql`excluded.code`,
          updatedAt: sql`now()`,
        },
        setWhere: sql`
          ${problemStarterCode.id} is distinct from excluded.id
          or ${problemStarterCode.code} is distinct from excluded.code
        `,
      });

    return {
      problemCount: plan.problemRows.length,
      starterCodeCount: plan.starterCodeRows.length,
    };
  });
}
