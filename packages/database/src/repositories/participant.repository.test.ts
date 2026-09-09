import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

import type { DatabaseClient } from "../client.js";
import type { SessionParticipant } from "../schema.js";
import {
  findCandidateParticipant,
  findInterviewerParticipant,
  findParticipantById,
  listParticipantsBySession,
} from "./participant.repository.js";

const sessionId = "30000000-0000-4000-8000-000000000001";
const interviewerId = "50000000-0000-4000-8000-000000000001";
const candidateId = "50000000-0000-4000-8000-000000000002";
const createdAt = new Date("2026-09-21T00:00:00.000Z");

const interviewer: SessionParticipant = {
  id: interviewerId,
  sessionId,
  userId: "550e8400-e29b-41d4-a716-446655440000",
  displayName: "Ada Lovelace",
  role: "interviewer",
  joinedAt: null,
  leftAt: null,
  createdAt,
};

const candidate: SessionParticipant = {
  id: candidateId,
  sessionId,
  userId: null,
  displayName: "Grace Hopper",
  role: "candidate",
  joinedAt: null,
  leftAt: null,
  createdAt,
};

function createFakeClient(rows: SessionParticipant[]) {
  const query = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(async () => rows),
    orderBy: vi.fn(async () => rows),
  };
  query.from.mockReturnValue(query);
  query.where.mockReturnValue(query);

  return {
    client: {
      db: { select: vi.fn(() => query) },
      close: vi.fn(),
    } as unknown as DatabaseClient,
    query,
  };
}

function compileSql(expression: unknown) {
  return new PgDialect().sqlToQuery(expression as SQL);
}

describe("participant repository", () => {
  it("finds a participant by ID", async () => {
    const { client, query } = createFakeClient([candidate]);

    await expect(findParticipantById(client, candidateId)).resolves.toEqual(
      candidate,
    );
    expect(compileSql(query.where.mock.calls[0]?.[0]).params).toEqual([
      candidateId,
    ]);
  });

  it("returns null when a participant is missing", async () => {
    const { client } = createFakeClient([]);

    await expect(findParticipantById(client, candidateId)).resolves.toBeNull();
  });

  it("lists participants for one session", async () => {
    const { client, query } = createFakeClient([interviewer, candidate]);

    await expect(listParticipantsBySession(client, sessionId)).resolves.toEqual(
      [interviewer, candidate],
    );
    expect(compileSql(query.where.mock.calls[0]?.[0]).params).toEqual([
      sessionId,
    ]);
    expect(query.orderBy).toHaveBeenCalledTimes(1);
  });

  it("finds interviewer and candidate roles within a session", async () => {
    const interviewerLookup = createFakeClient([interviewer]);
    const candidateLookup = createFakeClient([candidate]);

    await expect(
      findInterviewerParticipant(interviewerLookup.client, sessionId),
    ).resolves.toEqual(interviewer);
    await expect(
      findCandidateParticipant(candidateLookup.client, sessionId),
    ).resolves.toEqual(candidate);

    expect(
      compileSql(interviewerLookup.query.where.mock.calls[0]?.[0]).params,
    ).toEqual([sessionId, "interviewer"]);
    expect(
      compileSql(candidateLookup.query.where.mock.calls[0]?.[0]).params,
    ).toEqual([sessionId, "candidate"]);
  });
});
