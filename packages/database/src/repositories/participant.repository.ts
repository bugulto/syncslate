import { and, asc, eq } from "drizzle-orm";

import type { DatabaseClient } from "../client.js";
import { sessionParticipants, type SessionParticipant } from "../schema.js";

export type FindParticipantByIdResult = SessionParticipant | null;
export type ListParticipantsBySessionResult = SessionParticipant[];
export type FindInterviewerParticipantResult = SessionParticipant | null;
export type FindCandidateParticipantResult = SessionParticipant | null;

export async function findParticipantById(
  client: DatabaseClient,
  participantId: string,
): Promise<FindParticipantByIdResult> {
  const [participant] = await client.db
    .select()
    .from(sessionParticipants)
    .where(eq(sessionParticipants.id, participantId))
    .limit(1);

  return participant ?? null;
}

export async function listParticipantsBySession(
  client: DatabaseClient,
  sessionId: string,
): Promise<ListParticipantsBySessionResult> {
  return client.db
    .select()
    .from(sessionParticipants)
    .where(eq(sessionParticipants.sessionId, sessionId))
    .orderBy(asc(sessionParticipants.createdAt), asc(sessionParticipants.id));
}

async function findParticipantByRole(
  client: DatabaseClient,
  sessionId: string,
  role: "interviewer" | "candidate",
): Promise<SessionParticipant | null> {
  const [participant] = await client.db
    .select()
    .from(sessionParticipants)
    .where(
      and(
        eq(sessionParticipants.sessionId, sessionId),
        eq(sessionParticipants.role, role),
      ),
    )
    .limit(1);

  return participant ?? null;
}

export function findInterviewerParticipant(
  client: DatabaseClient,
  sessionId: string,
): Promise<FindInterviewerParticipantResult> {
  return findParticipantByRole(client, sessionId, "interviewer");
}

export function findCandidateParticipant(
  client: DatabaseClient,
  sessionId: string,
): Promise<FindCandidateParticipantResult> {
  return findParticipantByRole(client, sessionId, "candidate");
}
