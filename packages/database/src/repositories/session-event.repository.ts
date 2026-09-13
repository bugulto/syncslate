import { and, asc, eq, gt, max } from "drizzle-orm";

import type { DatabaseClient } from "../client.js";
import {
  interviewSessions,
  sessionEvents,
  sessionParticipants,
} from "../schema.js";

export type AppendSessionEventInput = {
  sessionId: string;
  actorParticipantId: string | null;
  type: string;
  schemaVersion: number;
  payload: Record<string, unknown>;
  occurredAt: Date;
};

export type SessionEventRecord = {
  id: string;
  sessionId: string;
  sequence: number;
  actorParticipantId: string | null;
  type: string;
  schemaVersion: number;
  payload: Record<string, unknown>;
  occurredAt: string;
  createdAt: string;
};

export type AppendSessionEventResult = SessionEventRecord | null;

export type ListSessionEventsInput = {
  sessionId: string;
  afterSequence?: number;
};

export type ListSessionEventsResult = SessionEventRecord[];

function mapSessionEvent(
  event: typeof sessionEvents.$inferSelect,
): SessionEventRecord {
  return {
    ...event,
    occurredAt: event.occurredAt.toISOString(),
    createdAt: event.createdAt.toISOString(),
  };
}

export async function appendSessionEvent(
  client: DatabaseClient,
  input: AppendSessionEventInput,
): Promise<AppendSessionEventResult> {
  return client.db.transaction(async (transaction) => {
    const [session] = await transaction
      .select({ id: interviewSessions.id })
      .from(interviewSessions)
      .where(eq(interviewSessions.id, input.sessionId))
      .for("update");

    if (session === undefined) {
      return null;
    }

    if (input.actorParticipantId !== null) {
      const [actor] = await transaction
        .select({ id: sessionParticipants.id })
        .from(sessionParticipants)
        .where(
          and(
            eq(sessionParticipants.id, input.actorParticipantId),
            eq(sessionParticipants.sessionId, input.sessionId),
          ),
        )
        .limit(1);

      if (actor === undefined) {
        return null;
      }
    }

    const [latestEvent] = await transaction
      .select({ sequence: max(sessionEvents.sequence) })
      .from(sessionEvents)
      .where(eq(sessionEvents.sessionId, input.sessionId));
    const sequence = (latestEvent?.sequence ?? 0) + 1;

    const [createdEvent] = await transaction
      .insert(sessionEvents)
      .values({ ...input, sequence })
      .returning();

    if (createdEvent === undefined) {
      throw new Error("Session event insert did not return the created event");
    }

    return mapSessionEvent(createdEvent);
  });
}

export async function listSessionEvents(
  client: DatabaseClient,
  input: ListSessionEventsInput,
): Promise<ListSessionEventsResult> {
  const predicate =
    input.afterSequence === undefined
      ? eq(sessionEvents.sessionId, input.sessionId)
      : and(
          eq(sessionEvents.sessionId, input.sessionId),
          gt(sessionEvents.sequence, input.afterSequence),
        );

  const rows = await client.db
    .select()
    .from(sessionEvents)
    .where(predicate)
    .orderBy(asc(sessionEvents.sequence));

  return rows.map(mapSessionEvent);
}
