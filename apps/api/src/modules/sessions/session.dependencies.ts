import type {
  CreateSessionInput,
  CreateSessionResult,
  FindSessionByIdForInterviewerInput,
  FindSessionByIdForInterviewerResult,
  ListSessionsByInterviewerInput,
  ListSessionsByInterviewerResult,
} from "@syncslate/database";

import type { FindVisibleProblemByIdRepository } from "../problems/problem.dependencies.js";

export type CreateSessionRepository = (
  input: CreateSessionInput,
) => Promise<CreateSessionResult>;

export type ListSessionsByInterviewerRepository = (
  input: ListSessionsByInterviewerInput,
) => Promise<ListSessionsByInterviewerResult>;

export type FindSessionByIdForInterviewerRepository = (
  input: FindSessionByIdForInterviewerInput,
) => Promise<FindSessionByIdForInterviewerResult>;

export type SessionRepositoryDependencies = {
  createSession: CreateSessionRepository;
  listSessionsByInterviewer: ListSessionsByInterviewerRepository;
  findSessionByIdForInterviewer: FindSessionByIdForInterviewerRepository;
  findVisibleProblemById: FindVisibleProblemByIdRepository;
};
