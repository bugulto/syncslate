import { randomUUID } from "node:crypto";

import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabaseClient, type DatabaseClient } from "../client.js";
import {
  problems,
  profiles,
  sessionEvents,
  sessionParticipants,
} from "../schema.js";
import {
  appendSessionEvent,
  listSessionEvents,
} from "./session-event.repository.js";
import { createSession } from "./session.repository.js";

describe("session event repository integration", () => {
  let client: DatabaseClient;

  beforeAll(() => {
    const directDatabaseUrl = process.env.DIRECT_DATABASE_URL?.trim();

    client = createDatabaseClient({
      connectionString: directDatabaseUrl || process.env.DATABASE_URL,
      maxConnections: 4,
    });
  });

  afterAll(async () => {
    await client.close();
  });

  it("allocates durable per-session sequences for concurrent writers", async () => {
    const ownerId = randomUUID();
    const problemId = randomUUID();
    const marker = randomUUID().slice(0, 8);

    try {
      await client.db.execute(sql`
        insert into auth.users (
          id,
          aud,
          role,
          email,
          encrypted_password,
          email_confirmed_at,
          created_at,
          updated_at
        )
        values (
          ${ownerId}::uuid,
          'authenticated',
          'authenticated',
          ${`event-owner-${marker}@example.com`},
          '',
          now(),
          now(),
          now()
        )
      `);
      await client.db.insert(profiles).values({
        id: ownerId,
        displayName: "Event Owner",
      });
      await client.db.insert(problems).values({
        id: problemId,
        ownerId,
        visibility: "private",
        title: `Event problem ${marker}`,
        slug: `event-problem-${marker}`,
        descriptionMarkdown: "Event ordering test problem.",
        difficulty: "easy",
        tags: ["events"],
        constraintsMarkdown: null,
        examples: [],
        interviewerNotesMarkdown: null,
      });

      const session = await createSession(client, {
        interviewerId: ownerId,
        interviewerDisplayName: "Event Owner",
        problemId,
        title: `Event session ${marker}`,
        language: "typescript",
        durationSeconds: 3600,
        status: "waiting",
        editingPolicy: "candidate_only",
        timerState: { status: "idle", durationMs: 3_600_000 },
      });
      const [interviewer] = await client.db
        .select({ id: sessionParticipants.id })
        .from(sessionParticipants)
        .where(eq(sessionParticipants.sessionId, session.id));
      if (interviewer === undefined) {
        throw new Error(
          "Created session is missing its interviewer participant",
        );
      }
      const occurredAt = new Date("2026-09-22T08:00:00.000Z");

      const concurrentEvents = await Promise.all(
        Array.from({ length: 8 }, (_, index) =>
          appendSessionEvent(client, {
            sessionId: session.id,
            actorParticipantId: interviewer.id,
            type: "participant.reconnected",
            schemaVersion: 1,
            payload: { attempt: index },
            occurredAt,
          }),
        ),
      );

      expect(
        concurrentEvents
          .map((event) => event?.sequence)
          .sort((left, right) => (left ?? 0) - (right ?? 0)),
      ).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);

      const nextEvent = await appendSessionEvent(client, {
        sessionId: session.id,
        actorParticipantId: null,
        type: "participant.disconnected",
        schemaVersion: 1,
        payload: { reason: "heartbeat_timeout" },
        occurredAt,
      });
      expect(nextEvent?.sequence).toBe(9);

      const storedEvents = await listSessionEvents(client, {
        sessionId: session.id,
        afterSequence: 6,
      });
      expect(storedEvents.map(({ sequence }) => sequence)).toEqual([7, 8, 9]);
      expect(storedEvents.at(-1)).toMatchObject({
        actorParticipantId: null,
        payload: { reason: "heartbeat_timeout" },
        occurredAt: occurredAt.toISOString(),
      });

      await expect(
        appendSessionEvent(client, {
          sessionId: session.id,
          actorParticipantId: randomUUID(),
          type: "participant.reconnected",
          schemaVersion: 1,
          payload: {},
          occurredAt,
        }),
      ).resolves.toBeNull();

      const persistedRows = await client.db
        .select({ sequence: sessionEvents.sequence })
        .from(sessionEvents)
        .where(eq(sessionEvents.sessionId, session.id));
      expect(persistedRows).toHaveLength(9);
    } finally {
      await client.db.execute(
        sql`delete from auth.users where id = ${ownerId}::uuid`,
      );
    }
  });
});
