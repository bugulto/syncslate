import { z } from "zod";

import { displayNameSchema } from "./auth.js";
import { participantRoleSchema, presenceStatusSchema } from "./domain.js";
import { utcDateTimeSchema, uuidSchema } from "./fields.js";

export const participantSchema = z
  .object({
    id: uuidSchema,
    displayName: displayNameSchema,
    role: participantRoleSchema,
  })
  .strict();

export type Participant = z.infer<typeof participantSchema>;

export const participantPresenceSchema = z
  .object({
    participant: participantSchema,
    status: presenceStatusSchema,
    lastSeenAt: utcDateTimeSchema,
  })
  .strict();

export type ParticipantPresence = z.infer<typeof participantPresenceSchema>;

export const presenceListSchema = z
  .array(participantPresenceSchema)
  .max(2, "A room can contain at most two participants")
  .refine(
    (entries) =>
      new Set(entries.map((entry) => entry.participant.id)).size ===
      entries.length,
    "Presence entries must have unique participant IDs",
  )
  .refine(
    (entries) =>
      new Set(entries.map((entry) => entry.participant.role)).size ===
      entries.length,
    "A room can contain at most one participant per role",
  );

export type PresenceList = z.infer<typeof presenceListSchema>;
