import { z } from "zod";

export const problemVisibilitySchema = z.enum(["seeded", "private"]);

export type ProblemVisibility = z.infer<typeof problemVisibilitySchema>;

export const problemDifficultySchema = z.enum(["easy", "medium", "hard"]);

export type ProblemDifficulty = z.infer<typeof problemDifficultySchema>;

export const supportedLanguageSchema = z.enum([
  "typescript",
  "javascript",
  "python",
]);

export type SupportedLanguage = z.infer<typeof supportedLanguageSchema>;

export const sessionStatusSchema = z.enum([
  "waiting",
  "active",
  "paused",
  "completed",
  "cancelled",
]);

export type SessionStatus = z.infer<typeof sessionStatusSchema>;

export const editingPolicySchema = z.enum([
  "candidate_only",
  "collaborative",
  "interviewer_only",
]);

export type EditingPolicy = z.infer<typeof editingPolicySchema>;
