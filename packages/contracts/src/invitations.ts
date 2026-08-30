import { z } from "zod";

import { utcDateTimeSchema, uuidSchema } from "./fields.js";

export const rawInvitationTokenSchema = z
  .string()
  .min(32, "Invitation token is too short")
  .max(128, "Invitation token is too long")
  .regex(
    /^[A-Za-z0-9_-]+$/,
    "Invitation token must use URL-safe characters only",
  );

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
