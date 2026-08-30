import { z } from "zod";

import {
  problemDifficultySchema,
  problemVisibilitySchema,
  supportedLanguageSchema,
} from "./domain.js";
import {
  searchQuerySchema,
  tagsSchema,
  titleSchema,
  utcDateTimeSchema,
  uuidSchema,
} from "./fields.js";

const markdownSchema = z.string().min(1, "Markdown content cannot be empty");

export const problemSlugSchema = z
  .string()
  .trim()
  .min(1, "Problem slug is required")
  .max(120, "Problem slug must be 120 characters or fewer")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Problem slug must contain lowercase letters, numbers, and hyphens only",
  );

export const problemExampleSchema = z
  .object({
    input: z.string().min(1, "Example input cannot be empty"),
    output: z.string().min(1, "Example output cannot be empty"),
    explanation: z.string().min(1).nullable(),
  })
  .strict();

export type ProblemExample = z.infer<typeof problemExampleSchema>;

export const problemStarterCodeSchema = z
  .object({
    language: supportedLanguageSchema,
    code: z.string().min(1, "Starter code cannot be empty"),
  })
  .strict();

export type ProblemStarterCode = z.infer<typeof problemStarterCodeSchema>;

const availableLanguagesSchema = z
  .array(supportedLanguageSchema)
  .min(1, "At least one language is required")
  .refine(
    (languages) => new Set(languages).size === languages.length,
    "Available languages must be unique",
  );

export const problemSummarySchema = z
  .object({
    id: uuidSchema,
    title: titleSchema,
    slug: problemSlugSchema,
    difficulty: problemDifficultySchema,
    tags: tagsSchema,
    visibility: problemVisibilitySchema,
    availableLanguages: availableLanguagesSchema,
  })
  .strict();

export type ProblemSummary = z.infer<typeof problemSummarySchema>;

export const problemDetailSchema = z
  .object({
    id: uuidSchema,
    title: titleSchema,
    slug: problemSlugSchema,
    difficulty: problemDifficultySchema,
    tags: tagsSchema,
    visibility: problemVisibilitySchema,
    availableLanguages: availableLanguagesSchema,
    descriptionMarkdown: markdownSchema,
    constraintsMarkdown: markdownSchema.nullable(),
    examples: z.array(problemExampleSchema),
    interviewerNotesMarkdown: markdownSchema.nullable(),
    starterCode: z
      .array(problemStarterCodeSchema)
      .min(1, "At least one starter-code entry is required")
      .refine(
        (entries) =>
          new Set(entries.map((entry) => entry.language)).size ===
          entries.length,
        "Starter-code languages must be unique",
      ),
    createdAt: utcDateTimeSchema,
    updatedAt: utcDateTimeSchema,
  })
  .strict()
  .refine(
    (problem) => {
      const availableLanguages = new Set(problem.availableLanguages);
      const starterCodeLanguages = new Set(
        problem.starterCode.map((entry) => entry.language),
      );

      return (
        availableLanguages.size === starterCodeLanguages.size &&
        [...availableLanguages].every((language) =>
          starterCodeLanguages.has(language),
        )
      );
    },
    {
      message: "Available languages must match starter-code languages",
      path: ["availableLanguages"],
    },
  );

export type ProblemDetail = z.infer<typeof problemDetailSchema>;

export const listProblemsQuerySchema = z
  .object({
    q: searchQuerySchema.optional(),
    difficulty: problemDifficultySchema.optional(),
    tag: z.string().trim().min(1).max(32).optional(),
    language: supportedLanguageSchema.optional(),
  })
  .strict();

export type ListProblemsQuery = z.infer<typeof listProblemsQuerySchema>;

export const listProblemsResponseSchema = z
  .object({
    problems: z.array(problemSummarySchema),
  })
  .strict();

export type ListProblemsResponse = z.infer<typeof listProblemsResponseSchema>;

export const getProblemResponseSchema = z
  .object({
    problem: problemDetailSchema,
  })
  .strict();

export type GetProblemResponse = z.infer<typeof getProblemResponseSchema>;
