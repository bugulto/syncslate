import { z } from "zod";

export const problemVisibilityValues = ["seeded", "private"] as const;

export const problemVisibilitySchema = z.enum(problemVisibilityValues);

export type ProblemVisibility = z.infer<typeof problemVisibilitySchema>;

export const problemDifficultyValues = ["easy", "medium", "hard"] as const;

export const problemDifficultySchema = z.enum(problemDifficultyValues);

export type ProblemDifficulty = z.infer<typeof problemDifficultySchema>;

export const supportedLanguageValues = [
  "typescript",
  "javascript",
  "python",
] as const;

export const supportedLanguageSchema = z.enum(supportedLanguageValues);

export type SupportedLanguage = z.infer<typeof supportedLanguageSchema>;

export const sessionStatusValues = [
  "waiting",
  "active",
  "paused",
  "completed",
  "cancelled",
] as const;

export const sessionStatusSchema = z.enum(sessionStatusValues);

export type SessionStatus = z.infer<typeof sessionStatusSchema>;

export const editingPolicyValues = [
  "candidate_only",
  "collaborative",
  "interviewer_only",
] as const;

export const editingPolicySchema = z.enum(editingPolicyValues);

export type EditingPolicy = z.infer<typeof editingPolicySchema>;
