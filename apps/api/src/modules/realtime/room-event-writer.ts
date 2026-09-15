import {
  participantSchema,
  roomSessionSchema,
  utcDateTimeSchema,
  uuidSchema,
  type Participant,
  type RoomSession,
} from "@syncslate/contracts";
import type {
  AppendSessionEventInput,
  AppendSessionEventResult,
  HasSessionEventInput,
} from "@syncslate/database";
import { z } from "zod";

const participantJoinedPayloadSchema = z
  .object({ participant: participantSchema })
  .strict();
const participantDisconnectedPayloadSchema = z
  .object({
    participantId: uuidSchema,
    lastSeenAt: utcDateTimeSchema,
  })
  .strict();
const participantReconnectedPayloadSchema = z
  .object({
    participantId: uuidSchema,
    reconnectedAt: utcDateTimeSchema,
  })
  .strict();
const sessionStartedPayloadSchema = z
  .object({ session: roomSessionSchema })
  .strict();

export type AppendSessionEvent = (
  input: AppendSessionEventInput,
) => Promise<AppendSessionEventResult>;

export type HasSessionEvent = (input: HasSessionEventInput) => Promise<boolean>;

export type RoomEventWriter = {
  recordParticipantConnected(input: {
    sessionId: string;
    participant: Participant;
    occurredAt: Date;
  }): Promise<NonNullable<AppendSessionEventResult>>;
  recordParticipantDisconnected(input: {
    sessionId: string;
    participantId: string;
    lastSeenAt: Date;
  }): Promise<NonNullable<AppendSessionEventResult>>;
  recordSessionStarted(input: {
    sessionId: string;
    actorParticipantId: string;
    session: RoomSession;
    occurredAt: Date;
  }): Promise<NonNullable<AppendSessionEventResult>>;
  flush(): Promise<void>;
};

export function createRoomEventWriter(options: {
  appendSessionEvent: AppendSessionEvent;
  hasSessionEvent: HasSessionEvent;
}): RoomEventWriter {
  const sessionTails = new Map<string, Promise<unknown>>();

  function enqueue<T>(sessionId: string, task: () => Promise<T>): Promise<T> {
    const previous = sessionTails.get(sessionId) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(task);
    const settled = current.then(
      () => undefined,
      () => undefined,
    );
    const tail = settled.finally(() => {
      if (sessionTails.get(sessionId) === tail) {
        sessionTails.delete(sessionId);
      }
    });

    sessionTails.set(sessionId, tail);
    return current;
  }

  async function appendRequired(
    input: AppendSessionEventInput,
  ): Promise<NonNullable<AppendSessionEventResult>> {
    const event = await options.appendSessionEvent(input);

    if (event === null) {
      throw new Error("Room event could not be persisted");
    }

    return event;
  }

  return {
    recordParticipantConnected(input) {
      return enqueue(input.sessionId, async () => {
        const hasJoined = await options.hasSessionEvent({
          sessionId: input.sessionId,
          actorParticipantId: input.participant.id,
          type: "participant.joined",
        });
        const occurredAt = input.occurredAt.toISOString();

        return hasJoined
          ? appendRequired({
              sessionId: input.sessionId,
              actorParticipantId: input.participant.id,
              type: "participant.reconnected",
              schemaVersion: 1,
              payload: participantReconnectedPayloadSchema.parse({
                participantId: input.participant.id,
                reconnectedAt: occurredAt,
              }),
              occurredAt: input.occurredAt,
            })
          : appendRequired({
              sessionId: input.sessionId,
              actorParticipantId: input.participant.id,
              type: "participant.joined",
              schemaVersion: 1,
              payload: participantJoinedPayloadSchema.parse({
                participant: input.participant,
              }),
              occurredAt: input.occurredAt,
            });
      });
    },

    recordParticipantDisconnected(input) {
      return enqueue(input.sessionId, () =>
        appendRequired({
          sessionId: input.sessionId,
          actorParticipantId: input.participantId,
          type: "participant.disconnected",
          schemaVersion: 1,
          payload: participantDisconnectedPayloadSchema.parse({
            participantId: input.participantId,
            lastSeenAt: input.lastSeenAt.toISOString(),
          }),
          occurredAt: input.lastSeenAt,
        }),
      );
    },

    recordSessionStarted(input) {
      return enqueue(input.sessionId, () =>
        appendRequired({
          sessionId: input.sessionId,
          actorParticipantId: input.actorParticipantId,
          type: "session.started",
          schemaVersion: 1,
          payload: sessionStartedPayloadSchema.parse({
            session: input.session,
          }),
          occurredAt: input.occurredAt,
        }),
      );
    },

    async flush() {
      await Promise.allSettled([...sessionTails.values()]);
    },
  };
}
