import type { InvitationMetadata, SessionStatus } from "@syncslate/contracts";
import { and, eq, isNull } from "drizzle-orm";

import type { DatabaseClient } from "../client.js";
import {
  interviewSessions,
  sessionInvitations,
  sessionParticipants,
} from "../schema.js";

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

export type AdmitCandidateByTokenHashInput = {
  tokenHash: string;
  displayName: string;
  now: Date;
};

export type AdmitCandidateByTokenHashResult =
  | {
      kind: "joined";
      sessionId: string;
      participant: {
        id: string;
        displayName: string;
        role: "candidate";
      };
    }
  | { kind: "not_found" }
  | { kind: "expired" }
  | { kind: "revoked" }
  | { kind: "consumed" }
  | { kind: "session_closed" }
  | { kind: "session_full" };

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

export async function admitCandidateByTokenHash(
  client: DatabaseClient,
  input: AdmitCandidateByTokenHashInput,
): Promise<AdmitCandidateByTokenHashResult> {
  return client.db.transaction(async (transaction) => {
    const [invitation] = await transaction
      .select({
        id: sessionInvitations.id,
        sessionId: sessionInvitations.sessionId,
        expiresAt: sessionInvitations.expiresAt,
        consumedAt: sessionInvitations.consumedAt,
        revokedAt: sessionInvitations.revokedAt,
        sessionStatus: interviewSessions.status,
      })
      .from(sessionInvitations)
      .innerJoin(
        interviewSessions,
        eq(interviewSessions.id, sessionInvitations.sessionId),
      )
      .where(eq(sessionInvitations.tokenHash, input.tokenHash))
      .for("update")
      .limit(1);

    if (invitation === undefined) {
      return { kind: "not_found" };
    }

    if (invitation.expiresAt <= input.now) {
      return { kind: "expired" };
    }

    if (invitation.revokedAt !== null) {
      return { kind: "revoked" };
    }

    if (invitation.consumedAt !== null) {
      return { kind: "consumed" };
    }

    if (
      invitation.sessionStatus !== "waiting" &&
      invitation.sessionStatus !== "active"
    ) {
      return { kind: "session_closed" };
    }

    const [existingCandidate] = await transaction
      .select({ id: sessionParticipants.id })
      .from(sessionParticipants)
      .where(
        and(
          eq(sessionParticipants.sessionId, invitation.sessionId),
          eq(sessionParticipants.role, "candidate"),
        ),
      )
      .limit(1);

    if (existingCandidate !== undefined) {
      return { kind: "session_full" };
    }

    const [participant] = await transaction
      .insert(sessionParticipants)
      .values({
        sessionId: invitation.sessionId,
        displayName: input.displayName,
        role: "candidate",
        joinedAt: input.now,
      })
      .returning({
        id: sessionParticipants.id,
        displayName: sessionParticipants.displayName,
        role: sessionParticipants.role,
      });

    if (participant === undefined || participant.role !== "candidate") {
      throw new Error(
        "Candidate insert did not return the created participant",
      );
    }

    const consumedInvitations = await transaction
      .update(sessionInvitations)
      .set({ consumedAt: input.now })
      .where(
        and(
          eq(sessionInvitations.id, invitation.id),
          isNull(sessionInvitations.consumedAt),
          isNull(sessionInvitations.revokedAt),
        ),
      )
      .returning({ id: sessionInvitations.id });

    if (consumedInvitations.length !== 1) {
      throw new Error(
        "Invitation could not be consumed after candidate insert",
      );
    }

    return {
      kind: "joined",
      sessionId: invitation.sessionId,
      participant: {
        id: participant.id,
        displayName: participant.displayName,
        role: "candidate",
      },
    };
  });
}
