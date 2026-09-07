import type {
  InvitationMetadata,
  RevokeInvitationResponse,
} from "@syncslate/contracts";

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
