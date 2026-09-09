import type { CreateSessionRequest, SessionDetail } from "@syncslate/contracts";

import type { SessionRepositoryDependencies } from "./session.dependencies.js";

type SessionCreationDependencies = Pick<
  SessionRepositoryDependencies,
  "createSession" | "findVisibleProblemById"
>;

export type CreateWaitingSessionInput = CreateSessionRequest & {
  interviewerId: string;
  interviewerDisplayName: string;
};

export type CreateWaitingSessionResult =
  | { kind: "created"; session: SessionDetail }
  | { kind: "problem_not_found" }
  | { kind: "unsupported_language" };

export type CreateWaitingSessionService = (
  input: CreateWaitingSessionInput,
) => Promise<CreateWaitingSessionResult>;

export function createSessionCreationService(
  dependencies: SessionCreationDependencies,
): CreateWaitingSessionService {
  return async (input) => {
    const problem = await dependencies.findVisibleProblemById({
      requesterId: input.interviewerId,
      problemId: input.problemId,
    });

    if (problem === null) {
      return { kind: "problem_not_found" };
    }

    if (
      !problem.starterCode.some(
        (starterCode) => starterCode.language === input.language,
      )
    ) {
      return { kind: "unsupported_language" };
    }

    const session = await dependencies.createSession({
      interviewerId: input.interviewerId,
      interviewerDisplayName: input.interviewerDisplayName,
      problemId: input.problemId,
      title: input.title,
      language: input.language,
      durationSeconds: input.durationSeconds,
      status: "waiting",
      editingPolicy: "candidate_only",
      timerState: {
        status: "idle",
        durationMs: input.durationSeconds * 1000,
      },
    });

    return { kind: "created", session };
  };
}
