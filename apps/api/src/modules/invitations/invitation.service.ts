import type {
  InvitationPreview,
  InvitationMetadata,
  JoinInvitationResponse,
  RevokeInvitationResponse,
} from "@syncslate/contracts";

import type { GuestTokenIssuer } from "../auth/guest-token.js";

import type { InvitationRepositoryDependencies } from "./invitation.dependencies.js";
import {
  generateInvitationToken,
  hashInvitationToken,
} from "./invitation-token.js";

export const DEFAULT_INVITATION_TTL_MS = 24 * 60 * 60 * 1000;

type InvitationCreationDependencies = Pick<
  InvitationRepositoryDependencies,
  "createInvitationForOwnedSession"
> & {
  tokenPepper: string;
  invitationTtlMs?: number;
  generateToken?: () => string;
  now?: () => Date;
};

type InvitationRevocationDependencies = Pick<
  InvitationRepositoryDependencies,
  "revokeInvitationForOwnedSession"
> & {
  now?: () => Date;
};

type InvitationInspectionDependencies = Pick<
  InvitationRepositoryDependencies,
  "findInvitationPreviewByTokenHash"
> & {
  tokenPepper: string;
  now?: () => Date;
};

type InvitationJoinDependencies = Pick<
  InvitationRepositoryDependencies,
  "admitCandidateByTokenHash"
> & {
  tokenPepper: string;
  issueGuestToken: GuestTokenIssuer;
  now?: () => Date;
};

export type CreateInvitationInput = {
  interviewerId: string;
  sessionId: string;
};

export type CreateInvitationResult =
  | {
      kind: "created";
      invitation: InvitationMetadata;
      rawToken: string;
    }
  | { kind: "session_not_found" };

export type CreateInvitationService = (
  input: CreateInvitationInput,
) => Promise<CreateInvitationResult>;

export type RevokeInvitationInput = CreateInvitationInput;

export type RevokeInvitationResult =
  | {
      kind: "revoked";
      invitation: RevokeInvitationResponse["invitation"];
    }
  | { kind: "invitation_not_found" };

export type RevokeInvitationService = (
  input: RevokeInvitationInput,
) => Promise<RevokeInvitationResult>;

type InvitationUnavailableKind =
  | "not_found"
  | "expired"
  | "revoked"
  | "consumed"
  | "session_closed"
  | "session_full";

export type InspectInvitationResult =
  | { kind: "available"; invitation: InvitationPreview }
  | { kind: InvitationUnavailableKind };

export type InspectInvitationService = (input: {
  rawToken: string;
}) => Promise<InspectInvitationResult>;

export type JoinInvitationResult =
  | ({ kind: "joined" } & JoinInvitationResponse)
  | { kind: InvitationUnavailableKind };

export type JoinInvitationService = (input: {
  rawToken: string;
  displayName: string;
}) => Promise<JoinInvitationResult>;

export function createInvitationCreationService(
  dependencies: InvitationCreationDependencies,
): CreateInvitationService {
  const invitationTtlMs =
    dependencies.invitationTtlMs ?? DEFAULT_INVITATION_TTL_MS;
  const generateToken = dependencies.generateToken ?? generateInvitationToken;
  const now = dependencies.now ?? (() => new Date());

  return async (input) => {
    const rawToken = generateToken();
    const tokenHash = hashInvitationToken(rawToken, dependencies.tokenPepper);
    const expiresAt = new Date(now().getTime() + invitationTtlMs);
    const invitation = await dependencies.createInvitationForOwnedSession({
      interviewerId: input.interviewerId,
      sessionId: input.sessionId,
      tokenHash,
      expiresAt,
    });

    if (invitation === null) {
      return { kind: "session_not_found" };
    }

    return {
      kind: "created",
      invitation,
      rawToken,
    };
  };
}

export function createInvitationRevocationService(
  dependencies: InvitationRevocationDependencies,
): RevokeInvitationService {
  const now = dependencies.now ?? (() => new Date());

  return async (input) => {
    const invitation = await dependencies.revokeInvitationForOwnedSession({
      interviewerId: input.interviewerId,
      sessionId: input.sessionId,
      revokedAt: now(),
    });

    if (invitation === null) {
      return { kind: "invitation_not_found" };
    }

    if (invitation.revokedAt === null) {
      throw new Error("Revoked invitation is missing its revocation timestamp");
    }

    return {
      kind: "revoked",
      invitation: { ...invitation, revokedAt: invitation.revokedAt },
    };
  };
}

export function createInvitationInspectionService(
  dependencies: InvitationInspectionDependencies,
): InspectInvitationService {
  const now = dependencies.now ?? (() => new Date());

  return async ({ rawToken }) => {
    const tokenHash = hashInvitationToken(rawToken, dependencies.tokenPepper);
    const invitation = await dependencies.findInvitationPreviewByTokenHash({
      tokenHash,
    });

    if (invitation === null) {
      return { kind: "not_found" };
    }
    if (invitation.expiresAt <= now()) {
      return { kind: "expired" };
    }
    if (invitation.revokedAt !== null) {
      return { kind: "revoked" };
    }
    if (invitation.consumedAt !== null) {
      return { kind: "consumed" };
    }
    if (
      invitation.session.status !== "waiting" &&
      invitation.session.status !== "active"
    ) {
      return { kind: "session_closed" };
    }
    if (invitation.candidateParticipantId !== null) {
      return { kind: "session_full" };
    }

    return {
      kind: "available",
      invitation: {
        session: invitation.session,
        expiresAt: invitation.expiresAt.toISOString(),
      },
    };
  };
}

export function createInvitationJoinService(
  dependencies: InvitationJoinDependencies,
): JoinInvitationService {
  const now = dependencies.now ?? (() => new Date());

  return async ({ rawToken, displayName }) => {
    const tokenHash = hashInvitationToken(rawToken, dependencies.tokenPepper);
    const result = await dependencies.admitCandidateByTokenHash({
      tokenHash,
      displayName,
      now: now(),
    });

    if (result.kind !== "joined") {
      return result;
    }

    const credential = await dependencies.issueGuestToken({
      participantId: result.participant.id,
      sessionId: result.sessionId,
    });

    return {
      kind: "joined",
      participant: result.participant,
      guestAccessToken: credential.token,
      expiresAt: credential.expiresAt.toISOString(),
    };
  };
}
