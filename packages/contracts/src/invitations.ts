import { z } from "zod";

import { displayNameSchema } from "./auth.js";
import {
  problemDifficultySchema,
  sessionStatusSchema,
  supportedLanguageSchema,
} from "./domain.js";
import {
  durationSecondsSchema,
  titleSchema,
  utcDateTimeSchema,
  uuidSchema,
} from "./fields.js";
import { participantSchema } from "./participants.js";

export const rawInvitationTokenSchema = z
  .string()
  .min(32, "Invitation token is too short")
  .max(128, "Invitation token is too long")
  .regex(
    /^[A-Za-z0-9_-]+$/,
    "Invitation token must use URL-safe characters only",
  );

export const invitationParamsSchema = z
  .object({
    rawToken: rawInvitationTokenSchema,
  })
  .strict();

export type InvitationParams = z.infer<typeof invitationParamsSchema>;

export const invitationMetadataSchema = z
  .object({
    id: uuidSchema,
    sessionId: uuidSchema,
    expiresAt: utcDateTimeSchema,
    consumedAt: utcDateTimeSchema.nullable(),
    revokedAt: utcDateTimeSchema.nullable(),
    createdAt: utcDateTimeSchema,
  })
  .strict();

export type InvitationMetadata = z.infer<typeof invitationMetadataSchema>;

export const createInvitationResponseSchema = z
  .object({
    invitation: invitationMetadataSchema,
    rawToken: rawInvitationTokenSchema,
  })
  .strict();

export type CreateInvitationResponse = z.infer<
  typeof createInvitationResponseSchema
>;

export const revokeInvitationResponseSchema = z
  .object({
    invitation: invitationMetadataSchema.extend({
      revokedAt: utcDateTimeSchema,
    }),
  })
  .strict();

export type RevokeInvitationResponse = z.infer<
  typeof revokeInvitationResponseSchema
>;

export const invitationPreviewSchema = z
  .object({
    session: z
      .object({
        title: titleSchema,
        status: sessionStatusSchema,
        language: supportedLanguageSchema,
        durationSeconds: durationSecondsSchema,
        problem: z
          .object({
            title: titleSchema,
            difficulty: problemDifficultySchema,
          })
          .strict()
          .nullable(),
      })
      .strict(),
    expiresAt: utcDateTimeSchema,
  })
  .strict();

export type InvitationPreview = z.infer<typeof invitationPreviewSchema>;

export const inspectInvitationResponseSchema = z
  .object({
    invitation: invitationPreviewSchema,
  })
  .strict();

export type InspectInvitationResponse = z.infer<
  typeof inspectInvitationResponseSchema
>;

export const joinInvitationRequestSchema = z
  .object({
    displayName: displayNameSchema,
  })
  .strict();

export type JoinInvitationRequest = z.infer<typeof joinInvitationRequestSchema>;

export const guestAccessTokenSchema = z
  .string()
  .trim()
  .min(32, "Guest access token is too short")
  .max(4096, "Guest access token is too long");

export const joinInvitationResponseSchema = z
  .object({
    participant: participantSchema.extend({ role: z.literal("candidate") }),
    guestAccessToken: guestAccessTokenSchema,
    expiresAt: utcDateTimeSchema,
  })
  .strict();

export type JoinInvitationResponse = z.infer<
  typeof joinInvitationResponseSchema
>;
