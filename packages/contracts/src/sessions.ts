import { z } from "zod";

import {
  editingPolicySchema,
  sessionStatusSchema,
  supportedLanguageSchema,
} from "./domain.js";
import {
  durationSecondsSchema,
  titleSchema,
  utcDateTimeSchema,
  uuidSchema,
} from "./fields.js";
import { problemDetailSchema, problemSummarySchema } from "./problems.js";

export const createSessionRequestSchema = z
  .object({
    title: titleSchema,
    problemId: uuidSchema,
    language: supportedLanguageSchema,
    durationSeconds: durationSecondsSchema,
  })
  .strict();

export type CreateSessionRequest = z.infer<typeof createSessionRequestSchema>;

export const sessionSummarySchema = z
  .object({
    id: uuidSchema,
    title: titleSchema,
    status: sessionStatusSchema,
    language: supportedLanguageSchema,
    editingPolicy: editingPolicySchema,
    durationSeconds: durationSecondsSchema,
    problem: problemSummarySchema.nullable(),
    createdAt: utcDateTimeSchema,
    updatedAt: utcDateTimeSchema,
  })
  .strict();

export type SessionSummary = z.infer<typeof sessionSummarySchema>;

export const sessionDetailSchema = z
  .object({
    id: uuidSchema,
    title: titleSchema,
    status: sessionStatusSchema,
    language: supportedLanguageSchema,
    editingPolicy: editingPolicySchema,
    durationSeconds: durationSecondsSchema,
    problem: problemDetailSchema.nullable(),
    startedAt: utcDateTimeSchema.nullable(),
    endedAt: utcDateTimeSchema.nullable(),
    createdAt: utcDateTimeSchema,
    updatedAt: utcDateTimeSchema,
  })
  .strict();

export type SessionDetail = z.infer<typeof sessionDetailSchema>;

export const createSessionResponseSchema = z
  .object({
    session: sessionDetailSchema,
  })
  .strict();

export type CreateSessionResponse = z.infer<typeof createSessionResponseSchema>;

export const listSessionsResponseSchema = z
  .object({
    sessions: z.array(sessionSummarySchema),
  })
  .strict();

export type ListSessionsResponse = z.infer<typeof listSessionsResponseSchema>;

export const getSessionResponseSchema = z
  .object({
    session: sessionDetailSchema,
  })
  .strict();

export type GetSessionResponse = z.infer<typeof getSessionResponseSchema>;
