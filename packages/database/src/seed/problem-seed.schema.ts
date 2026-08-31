import {
  problemDifficultySchema,
  problemExampleSchema,
  problemSlugSchema,
  supportedLanguageSchema,
  tagsSchema,
  titleSchema,
  uuidSchema,
} from "@syncslate/contracts";
import { z } from "zod";

const markdownSchema = z.string().min(1, "Markdown content cannot be empty");

export const seededStarterCodeSchema = z
  .object({
    id: uuidSchema,
    language: supportedLanguageSchema,
    code: z.string().min(1, "Starter code cannot be empty"),
  })
  .strict()
  .readonly();

export type SeededStarterCodeDefinition = z.infer<
  typeof seededStarterCodeSchema
>;

export const seededProblemSchema = z
  .object({
    id: uuidSchema,
    ownerId: z.null(),
    visibility: z.literal("seeded"),
    title: titleSchema,
    slug: problemSlugSchema,
    descriptionMarkdown: markdownSchema,
    difficulty: problemDifficultySchema,
    tags: tagsSchema.readonly(),
    constraintsMarkdown: markdownSchema.nullable(),
    examples: z.array(problemExampleSchema).min(1).readonly(),
    interviewerNotesMarkdown: markdownSchema.nullable(),
    starterCode: z
      .array(seededStarterCodeSchema)
      .min(1, "At least one starter-code entry is required")
      .superRefine((entries, context) => {
        const seenLanguages = new Set<string>();

        for (const [index, entry] of entries.entries()) {
          if (seenLanguages.has(entry.language)) {
            context.addIssue({
              code: "custom",
              message: "Starter-code languages must be unique per problem",
              path: [index, "language"],
            });
          }

          seenLanguages.add(entry.language);
        }
      })
      .readonly(),
  })
  .strict()
  .readonly();

export type SeededProblemDefinition = z.infer<typeof seededProblemSchema>;

export const seededProblemsSchema = z
  .array(seededProblemSchema)
  .min(1, "At least one seeded problem is required")
  .superRefine((problems, context) => {
    const seenProblemIds = new Set<string>();
    const seenSlugs = new Set<string>();
    const seenStarterCodeIds = new Set<string>();

    for (const [problemIndex, problem] of problems.entries()) {
      if (seenProblemIds.has(problem.id)) {
        context.addIssue({
          code: "custom",
          message: "Seeded problem IDs must be unique",
          path: [problemIndex, "id"],
        });
      }
      seenProblemIds.add(problem.id);

      if (seenSlugs.has(problem.slug)) {
        context.addIssue({
          code: "custom",
          message: "Seeded problem slugs must be unique",
          path: [problemIndex, "slug"],
        });
      }
      seenSlugs.add(problem.slug);

      for (const [starterIndex, starterCode] of problem.starterCode.entries()) {
        if (seenStarterCodeIds.has(starterCode.id)) {
          context.addIssue({
            code: "custom",
            message: "Seeded starter-code IDs must be globally unique",
            path: [problemIndex, "starterCode", starterIndex, "id"],
          });
        }
        seenStarterCodeIds.add(starterCode.id);
      }
    }
  })
  .readonly();

export type SeededProblems = z.infer<typeof seededProblemsSchema>;

export function parseSeededProblems(input: unknown): SeededProblems {
  return seededProblemsSchema.parse(input);
}
