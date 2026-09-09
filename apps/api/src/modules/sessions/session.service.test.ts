import type { ProblemDetail, SessionDetail } from "@syncslate/contracts";
import { describe, expect, it, vi } from "vitest";

import type { FindVisibleProblemByIdRepository } from "../problems/problem.dependencies.js";
import type { CreateSessionRepository } from "./session.dependencies.js";
import { createSessionCreationService } from "./session.service.js";

const interviewerId = "550e8400-e29b-41d4-a716-446655440000";
const problemId = "10000000-0000-4000-8000-000000000001";
const sessionId = "30000000-0000-4000-8000-000000000001";

const problem: ProblemDetail = {
  id: problemId,
  title: "Two Sum",
  slug: "two-sum",
  difficulty: "easy",
  tags: ["arrays"],
  visibility: "seeded",
  availableLanguages: ["typescript"],
  descriptionMarkdown: "Find two values.",
  constraintsMarkdown: null,
  examples: [],
  interviewerNotesMarkdown: null,
  starterCode: [
    { language: "typescript", code: "export function twoSum() {}" },
  ],
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

const session: SessionDetail = {
  id: sessionId,
  title: "Frontend interview",
  status: "waiting",
  language: "typescript",
  editingPolicy: "candidate_only",
  durationSeconds: 3600,
  problem,
  startedAt: null,
  endedAt: null,
  createdAt: "2026-09-01T01:00:00.000Z",
  updatedAt: "2026-09-01T01:00:00.000Z",
};

const creationInput = {
  interviewerId,
  interviewerDisplayName: "Ada Lovelace",
  problemId,
  title: session.title,
  language: "typescript" as const,
  durationSeconds: session.durationSeconds,
};

describe("createSessionCreationService", () => {
  it("returns problem_not_found without creating a session", async () => {
    const findVisibleProblemById = vi
      .fn<FindVisibleProblemByIdRepository>()
      .mockResolvedValue(null);
    const createSession = vi.fn<CreateSessionRepository>();
    const service = createSessionCreationService({
      findVisibleProblemById,
      createSession,
    });

    await expect(service(creationInput)).resolves.toEqual({
      kind: "problem_not_found",
    });
    expect(findVisibleProblemById).toHaveBeenCalledWith({
      requesterId: interviewerId,
      problemId,
    });
    expect(createSession).not.toHaveBeenCalled();
  });

  it("rejects a language without starter code", async () => {
    const findVisibleProblemById = vi
      .fn<FindVisibleProblemByIdRepository>()
      .mockResolvedValue(problem);
    const createSession = vi.fn<CreateSessionRepository>();
    const service = createSessionCreationService({
      findVisibleProblemById,
      createSession,
    });

    await expect(
      service({ ...creationInput, language: "python" }),
    ).resolves.toEqual({ kind: "unsupported_language" });
    expect(createSession).not.toHaveBeenCalled();
  });

  it("creates a waiting candidate-only session with an idle timer", async () => {
    const findVisibleProblemById = vi
      .fn<FindVisibleProblemByIdRepository>()
      .mockResolvedValue(problem);
    const createSession = vi
      .fn<CreateSessionRepository>()
      .mockResolvedValue(session);
    const service = createSessionCreationService({
      findVisibleProblemById,
      createSession,
    });

    await expect(service(creationInput)).resolves.toEqual({
      kind: "created",
      session,
    });
    expect(createSession).toHaveBeenCalledWith({
      ...creationInput,
      status: "waiting",
      editingPolicy: "candidate_only",
      timerState: {
        status: "idle",
        durationMs: 3_600_000,
      },
    });
  });

  it("allows repository failures to propagate to the route boundary", async () => {
    const findVisibleProblemById = vi
      .fn<FindVisibleProblemByIdRepository>()
      .mockRejectedValue(new Error("database unavailable"));
    const service = createSessionCreationService({
      findVisibleProblemById,
      createSession: vi.fn<CreateSessionRepository>(),
    });

    await expect(service(creationInput)).rejects.toThrow(
      "database unavailable",
    );
  });
});
