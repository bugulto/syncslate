import type { InvitationMetadata, SessionStatus } from "@syncslate/contracts";
import { and, eq, isNull } from "drizzle-orm";

import type { DatabaseClient } from "../client.js";
import { interviewSessions, sessionInvitations } from "../schema.js";

export type CreateInvitationForOwnedSessionInput = {
  interviewerId: string;
  sessionId: string;
  tokenHash: string;
  expiresAt: Date;
};

export type CreateInvitationForOwnedSessionResult = InvitationMetadata | null;

export type RevokeInvitationForOwnedSessionInput = {
  interviewerId: string;
  sessionId: string;
  revokedAt: Date;
};

export type RevokeInvitationForOwnedSessionResult = InvitationMetadata | null;

export type FindInvitationByTokenHashInput = {
  tokenHash: string;
};

export type FindInvitationByTokenHashResult = {
  id: string;
  sessionId: string;
  expiresAt: Date;
  consumedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  sessionStatus: SessionStatus;
} | null;

function toInvitationMetadata(invitation: {
  id: string;
  sessionId: string;
  expiresAt: Date;
  consumedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}): InvitationMetadata {
  return {
    id: invitation.id,
    sessionId: invitation.sessionId,
    expiresAt: invitation.expiresAt.toISOString(),
    consumedAt: invitation.consumedAt?.toISOString() ?? null,
    revokedAt: invitation.revokedAt?.toISOString() ?? null,
    createdAt: invitation.createdAt.toISOString(),
  };
}

async function ownsSession(
  client: DatabaseClient,
  interviewerId: string,
  sessionId: string,
): Promise<boolean> {
  const [ownedSession] = await client.db
    .select({ id: interviewSessions.id })
    .from(interviewSessions)
    .where(
      and(
        eq(interviewSessions.id, sessionId),
        eq(interviewSessions.interviewerId, interviewerId),
      ),
    )
    .limit(1);

  return ownedSession !== undefined;
}

export async function createInvitationForOwnedSession(
  client: DatabaseClient,
  input: CreateInvitationForOwnedSessionInput,
): Promise<CreateInvitationForOwnedSessionResult> {
  if (!(await ownsSession(client, input.interviewerId, input.sessionId))) {
    return null;
  }

  const [invitation] = await client.db
    .insert(sessionInvitations)
    .values({
      sessionId: input.sessionId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
    })
    .returning({
      id: sessionInvitations.id,
      sessionId: sessionInvitations.sessionId,
      expiresAt: sessionInvitations.expiresAt,
      consumedAt: sessionInvitations.consumedAt,
      revokedAt: sessionInvitations.revokedAt,
      createdAt: sessionInvitations.createdAt,
    });

  if (invitation === undefined) {
    throw new Error("Invitation insert did not return the created invitation");
  }

  return toInvitationMetadata(invitation);
}

export async function revokeInvitationForOwnedSession(
  client: DatabaseClient,
  input: RevokeInvitationForOwnedSessionInput,
): Promise<RevokeInvitationForOwnedSessionResult> {
  if (!(await ownsSession(client, input.interviewerId, input.sessionId))) {
    return null;
  }

  const revokedInvitations = await client.db
    .update(sessionInvitations)
    .set({ revokedAt: input.revokedAt })
    .where(
      and(
        eq(sessionInvitations.sessionId, input.sessionId),
        isNull(sessionInvitations.consumedAt),
        isNull(sessionInvitations.revokedAt),
      ),
    )
    .returning({
      id: sessionInvitations.id,
      sessionId: sessionInvitations.sessionId,
      expiresAt: sessionInvitations.expiresAt,
      consumedAt: sessionInvitations.consumedAt,
      revokedAt: sessionInvitations.revokedAt,
      createdAt: sessionInvitations.createdAt,
    });

  const invitation = revokedInvitations[0];
  return invitation === undefined ? null : toInvitationMetadata(invitation);
}

export async function findInvitationByTokenHash(
  client: DatabaseClient,
  input: FindInvitationByTokenHashInput,
): Promise<FindInvitationByTokenHashResult> {
  const [invitation] = await client.db
    .select({
      id: sessionInvitations.id,
      sessionId: sessionInvitations.sessionId,
      expiresAt: sessionInvitations.expiresAt,
      consumedAt: sessionInvitations.consumedAt,
      revokedAt: sessionInvitations.revokedAt,
      createdAt: sessionInvitations.createdAt,
      sessionStatus: interviewSessions.status,
    })
    .from(sessionInvitations)
    .innerJoin(
      interviewSessions,
      eq(interviewSessions.id, sessionInvitations.sessionId),
    )
    .where(eq(sessionInvitations.tokenHash, input.tokenHash))
    .limit(1);

  return invitation ?? null;
}
