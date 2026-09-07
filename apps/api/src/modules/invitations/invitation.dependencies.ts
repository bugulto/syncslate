import type {
  CreateInvitationForOwnedSessionInput,
  CreateInvitationForOwnedSessionResult,
  RevokeInvitationForOwnedSessionInput,
  RevokeInvitationForOwnedSessionResult,
} from "@syncslate/database";

export type CreateInvitationForOwnedSessionRepository = (
  input: CreateInvitationForOwnedSessionInput,
) => Promise<CreateInvitationForOwnedSessionResult>;

export type RevokeInvitationForOwnedSessionRepository = (
  input: RevokeInvitationForOwnedSessionInput,
) => Promise<RevokeInvitationForOwnedSessionResult>;

export type InvitationRepositoryDependencies = {
  createInvitationForOwnedSession: CreateInvitationForOwnedSessionRepository;
  revokeInvitationForOwnedSession: RevokeInvitationForOwnedSessionRepository;
};
