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
import { participantSchema, presenceListSchema } from "./participants.js";
import { candidateProblemSchema } from "./problems.js";
import { guestAccessTokenSchema } from "./invitations.js";

export const roomCredentialSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("user"),
      accessToken: z.string().trim().min(1).max(16_384),
    })
    .strict(),
  z
    .object({
      kind: z.literal("guest"),
      token: guestAccessTokenSchema,
    })
    .strict(),
]);

export type RoomCredential = z.infer<typeof roomCredentialSchema>;

export const roomSessionSchema = z
  .object({
    id: uuidSchema,
    title: titleSchema,
    status: sessionStatusSchema,
    language: supportedLanguageSchema,
    editingPolicy: editingPolicySchema,
    durationSeconds: durationSecondsSchema,
    startedAt: utcDateTimeSchema.nullable(),
  })
  .strict();

export type RoomSession = z.infer<typeof roomSessionSchema>;

export const roomStateSchema = z
  .object({
    session: roomSessionSchema,
    problem: candidateProblemSchema.nullable(),
    presence: presenceListSchema,
  })
  .strict();

export type RoomState = z.infer<typeof roomStateSchema>;

export const roomJoinCommandSchema = z
  .object({
    type: z.literal("room.join"),
    clientEventId: uuidSchema,
    payload: z
      .object({
        sessionId: uuidSchema,
        credential: roomCredentialSchema,
      })
      .strict(),
  })
  .strict();

export type RoomJoinCommand = z.infer<typeof roomJoinCommandSchema>;

export const roomClientCommandSchema = z.discriminatedUnion("type", [
  roomJoinCommandSchema,
]);

export type RoomClientCommand = z.infer<typeof roomClientCommandSchema>;

const roomEventBaseSchema = z.object({
  eventId: uuidSchema,
  roomId: uuidSchema,
  schemaVersion: z.literal(1),
  actorParticipantId: uuidSchema.nullable(),
  clientEventId: uuidSchema.optional(),
  sequence: z.number().int().nonnegative().optional(),
  occurredAt: utcDateTimeSchema,
});

export const roomJoinedEventSchema = roomEventBaseSchema
  .extend({
    type: z.literal("room.joined"),
    payload: z
      .object({
        participant: participantSchema,
        state: roomStateSchema,
      })
      .strict(),
  })
  .strict();

export const roomStateEventSchema = roomEventBaseSchema
  .extend({
    type: z.literal("room.state"),
    payload: z.object({ state: roomStateSchema }).strict(),
  })
  .strict();

export const roomErrorCodeSchema = z.enum([
  "UNAUTHORIZED",
  "FORBIDDEN",
  "VALIDATION_ERROR",
  "UNKNOWN_EVENT",
  "SESSION_CLOSED",
  "INTERNAL_SERVER_ERROR",
]);

export type RoomErrorCode = z.infer<typeof roomErrorCodeSchema>;

export const roomErrorEventSchema = roomEventBaseSchema
  .extend({
    type: z.literal("room.error"),
    payload: z
      .object({
        code: roomErrorCodeSchema,
        message: z.string().trim().min(1).max(200),
      })
      .strict(),
  })
  .strict();

export const presenceChangedEventSchema = roomEventBaseSchema
  .extend({
    type: z.literal("presence.changed"),
    payload: z.object({ presence: presenceListSchema }).strict(),
  })
  .strict();

export const participantDisconnectedEventSchema = roomEventBaseSchema
  .extend({
    type: z.literal("participant.disconnected"),
    payload: z
      .object({
        participantId: uuidSchema,
        lastSeenAt: utcDateTimeSchema,
      })
      .strict(),
  })
  .strict();

export const participantReconnectedEventSchema = roomEventBaseSchema
  .extend({
    type: z.literal("participant.reconnected"),
    payload: z
      .object({
        participantId: uuidSchema,
        reconnectedAt: utcDateTimeSchema,
      })
      .strict(),
  })
  .strict();

export const sessionStartedEventSchema = roomEventBaseSchema
  .extend({
    type: z.literal("session.started"),
    payload: z.object({ session: roomSessionSchema }).strict(),
  })
  .strict();

export const roomEventEnvelopeSchema = z.discriminatedUnion("type", [
  roomJoinedEventSchema,
  roomStateEventSchema,
  roomErrorEventSchema,
  presenceChangedEventSchema,
  participantDisconnectedEventSchema,
  participantReconnectedEventSchema,
  sessionStartedEventSchema,
]);

export type RoomEventEnvelope = z.infer<typeof roomEventEnvelopeSchema>;
