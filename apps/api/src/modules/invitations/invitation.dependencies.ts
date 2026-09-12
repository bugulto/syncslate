import type {
  AdmitCandidateByTokenHashInput,
  AdmitCandidateByTokenHashResult,
  CreateInvitationForOwnedSessionInput,
  CreateInvitationForOwnedSessionResult,
  FindInvitationByTokenHashInput,
  FindInvitationPreviewByTokenHashResult,
  RevokeInvitationForOwnedSessionInput,
  RevokeInvitationForOwnedSessionResult,
} from "@syncslate/database";

export type FindInvitationPreviewByTokenHashRepository = (
  input: FindInvitationByTokenHashInput,
) => Promise<FindInvitationPreviewByTokenHashResult>;

export type AdmitCandidateByTokenHashRepository = (
  input: AdmitCandidateByTokenHashInput,
) => Promise<AdmitCandidateByTokenHashResult>;

export type CreateInvitationForOwnedSessionRepository = (
  input: CreateInvitationForOwnedSessionInput,
) => Promise<CreateInvitationForOwnedSessionResult>;

export type RevokeInvitationForOwnedSessionRepository = (
  input: RevokeInvitationForOwnedSessionInput,
) => Promise<RevokeInvitationForOwnedSessionResult>;

export type InvitationRepositoryDependencies = {
  admitCandidateByTokenHash: AdmitCandidateByTokenHashRepository;
  createInvitationForOwnedSession: CreateInvitationForOwnedSessionRepository;
  findInvitationPreviewByTokenHash: FindInvitationPreviewByTokenHashRepository;
  revokeInvitationForOwnedSession: RevokeInvitationForOwnedSessionRepository;
};
