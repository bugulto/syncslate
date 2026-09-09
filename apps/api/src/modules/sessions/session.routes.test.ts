import {
  apiErrorSchema,
  createSessionResponseSchema,
  getSessionResponseSchema,
  listSessionsResponseSchema,
  type CurrentUser,
  type ProblemDetail,
  type SessionDetail,
  type SessionSummary,
} from "@syncslate/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "../../app.js";
import type { AccessTokenVerifier } from "../auth/access-token-verifier.js";
import type { AuthenticatedUser } from "../auth/authenticated-user.js";
import type {
  FindSessionByIdForInterviewerRepository,
  ListSessionsByInterviewerRepository,
} from "./session.dependencies.js";
import type { SessionRoutesOptions } from "./session.routes.js";
import type { CreateWaitingSessionService } from "./session.service.js";

const apps = new Set<ReturnType<typeof buildApp>>();
const userId = "550e8400-e29b-41d4-a716-446655440000";
const problemId = "10000000-0000-4000-8000-000000000001";
const sessionId = "30000000-0000-4000-8000-000000000001";
const authorization = { authorization: "Bearer valid-access-token" };

const authenticatedUser: AuthenticatedUser = {
  principal: { kind: "user", userId },
  email: "interviewer@example.com",
  displayName: "Ada Lovelace",
  avatarUrl: null,
};

const currentUser: CurrentUser = {
  id: userId,
  email: authenticatedUser.email,
  displayName: "Ada Lovelace",
  avatarUrl: null,
};

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

const sessionDetail: SessionDetail = {
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

const sessionSummary: SessionSummary = {
  id: sessionDetail.id,
  title: sessionDetail.title,
  status: sessionDetail.status,
  language: sessionDetail.language,
  editingPolicy: sessionDetail.editingPolicy,
  durationSeconds: sessionDetail.durationSeconds,
  problem: {
    id: problem.id,
    title: problem.title,
    slug: problem.slug,
    difficulty: problem.difficulty,
    tags: problem.tags,
    visibility: problem.visibility,
    availableLanguages: problem.availableLanguages,
  },
  createdAt: sessionDetail.createdAt,
  updatedAt: sessionDetail.updatedAt,
};

const creationPayload = {
  title: "  Frontend interview  ",
  problemId,
  language: "typescript" as const,
  durationSeconds: 3600,
};

function createSessionRouteOptions(
  overrides: Partial<SessionRoutesOptions> = {},
): SessionRoutesOptions {
  return {
    bootstrapProfile: vi.fn(async () => currentUser),
    createWaitingSession: vi
      .fn<CreateWaitingSessionService>()
      .mockResolvedValue({ kind: "created", session: sessionDetail }),
    findSessionByIdForInterviewer: vi
      .fn<FindSessionByIdForInterviewerRepository>()
      .mockResolvedValue(sessionDetail),
    listSessionsByInterviewer: vi
      .fn<ListSessionsByInterviewerRepository>()
      .mockResolvedValue([sessionSummary]),
    ...overrides,
  };
}

function buildSessionApp(options?: {
  routeOptions?: SessionRoutesOptions;
  verifyAccessToken?: AccessTokenVerifier;
}) {
  const routeOptions = options?.routeOptions ?? createSessionRouteOptions();
  const verifyAccessToken =
    options?.verifyAccessToken ??
    vi.fn<AccessTokenVerifier>().mockResolvedValue(authenticatedUser);
  const app = buildApp({
    logger: false,
    corsAllowedOrigins: ["http://localhost:3000"],
    checkReadiness: vi.fn(async () => undefined),
    createInvitation: vi.fn(async () => ({
      kind: "session_not_found" as const,
    })),
    findVisibleProblemById: vi.fn(async () => null),
    searchVisibleProblems: vi.fn(async () => []),
    revokeInvitation: vi.fn(async () => ({
      kind: "invitation_not_found" as const,
    })),
    verifyAccessToken,
    ...routeOptions,
  });
  apps.add(app);

  return { app, routeOptions, verifyAccessToken };
}

afterEach(async () => {
  await Promise.all([...apps].map((app) => app.close()));
  apps.clear();
  vi.clearAllMocks();
});

describe("session routes", () => {
  it.each([
    { method: "POST" as const, url: "/api/v1/sessions" },
    { method: "GET" as const, url: "/api/v1/sessions" },
    { method: "GET" as const, url: `/api/v1/sessions/${sessionId}` },
  ])("requires authentication for $method $url", async ({ method, url }) => {
    const routeOptions = createSessionRouteOptions();
    const { app } = buildSessionApp({
      routeOptions,
      verifyAccessToken: vi.fn<AccessTokenVerifier>(),
    });

    const response = await app.inject({ method, url });

    expect(response.statusCode).toBe(401);
    expect(apiErrorSchema.safeParse(response.json()).success).toBe(true);
    expect(routeOptions.bootstrapProfile).not.toHaveBeenCalled();
    expect(routeOptions.createWaitingSession).not.toHaveBeenCalled();
    expect(routeOptions.listSessionsByInterviewer).not.toHaveBeenCalled();
    expect(routeOptions.findSessionByIdForInterviewer).not.toHaveBeenCalled();
  });

  it("rejects malformed creation input before bootstrapping a profile", async () => {
    const routeOptions = createSessionRouteOptions();
    const { app } = buildSessionApp({ routeOptions });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/sessions",
      headers: authorization,
      payload: { ...creationPayload, durationSeconds: 60 },
    });

    expect(response.statusCode).toBe(400);
    expect(apiErrorSchema.parse(response.json())).toMatchObject({
      error: { code: "VALIDATION_ERROR" },
    });
    expect(routeOptions.bootstrapProfile).not.toHaveBeenCalled();
    expect(routeOptions.createWaitingSession).not.toHaveBeenCalled();
  });

  it("bootstraps the profile and creates a normalized waiting session", async () => {
    const routeOptions = createSessionRouteOptions();
    const { app } = buildSessionApp({ routeOptions });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/sessions",
      headers: authorization,
      payload: creationPayload,
    });

    expect(response.statusCode).toBe(201);
    expect(createSessionResponseSchema.parse(response.json())).toEqual({
      session: sessionDetail,
    });
    expect(routeOptions.bootstrapProfile).toHaveBeenCalledWith(
      authenticatedUser,
    );
    expect(routeOptions.createWaitingSession).toHaveBeenCalledWith({
      interviewerId: userId,
      interviewerDisplayName: currentUser.displayName,
      title: "Frontend interview",
      problemId,
      language: "typescript",
      durationSeconds: 3600,
    });
  });

  it("returns safe errors for unavailable problems and languages", async () => {
    const outcomes = [
      { kind: "problem_not_found" as const, status: 404, code: "NOT_FOUND" },
      {
        kind: "unsupported_language" as const,
        status: 400,
        code: "VALIDATION_ERROR",
      },
    ];

    for (const outcome of outcomes) {
      const routeOptions = createSessionRouteOptions({
        createWaitingSession: vi
          .fn<CreateWaitingSessionService>()
          .mockResolvedValue({ kind: outcome.kind }),
      });
      const { app } = buildSessionApp({ routeOptions });
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/sessions",
        headers: authorization,
        payload: creationPayload,
      });

      expect(response.statusCode).toBe(outcome.status);
      expect(apiErrorSchema.parse(response.json())).toMatchObject({
        error: { code: outcome.code },
      });
    }
  });

  it("returns a safe error when profile bootstrap fails", async () => {
    const routeOptions = createSessionRouteOptions({
      bootstrapProfile: vi
        .fn()
        .mockRejectedValue(new Error("sensitive profile failure")),
    });
    const { app } = buildSessionApp({ routeOptions });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/sessions",
      headers: authorization,
      payload: creationPayload,
    });

    expect(response.statusCode).toBe(500);
    expect(apiErrorSchema.safeParse(response.json()).success).toBe(true);
    expect(response.body).not.toContain("sensitive profile failure");
    expect(routeOptions.createWaitingSession).not.toHaveBeenCalled();
  });

  it("lists only sessions requested for the authenticated interviewer", async () => {
    const routeOptions = createSessionRouteOptions();
    const { app } = buildSessionApp({ routeOptions });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/sessions",
      headers: authorization,
    });

    expect(response.statusCode).toBe(200);
    expect(listSessionsResponseSchema.parse(response.json())).toEqual({
      sessions: [sessionSummary],
    });
    expect(routeOptions.listSessionsByInterviewer).toHaveBeenCalledWith({
      interviewerId: userId,
    });
  });

  it("loads detail using both the session and interviewer IDs", async () => {
    const routeOptions = createSessionRouteOptions();
    const { app } = buildSessionApp({ routeOptions });

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/sessions/${sessionId}`,
      headers: authorization,
    });

    expect(response.statusCode).toBe(200);
    expect(getSessionResponseSchema.parse(response.json())).toEqual({
      session: sessionDetail,
    });
    expect(routeOptions.findSessionByIdForInterviewer).toHaveBeenCalledWith({
      interviewerId: userId,
      sessionId,
    });
  });

  it("rejects malformed session IDs before repository access", async () => {
    const routeOptions = createSessionRouteOptions();
    const { app } = buildSessionApp({ routeOptions });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/sessions/not-a-uuid",
      headers: authorization,
    });

    expect(response.statusCode).toBe(400);
    expect(apiErrorSchema.parse(response.json())).toMatchObject({
      error: { code: "VALIDATION_ERROR" },
    });
    expect(routeOptions.findSessionByIdForInterviewer).not.toHaveBeenCalled();
  });

  it("returns a safe 404 for missing or cross-user sessions", async () => {
    const routeOptions = createSessionRouteOptions({
      findSessionByIdForInterviewer: vi
        .fn<FindSessionByIdForInterviewerRepository>()
        .mockResolvedValue(null),
    });
    const { app } = buildSessionApp({ routeOptions });

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/sessions/${sessionId}`,
      headers: authorization,
    });

    expect(response.statusCode).toBe(404);
    expect(apiErrorSchema.parse(response.json())).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Session not found.",
        requestId: expect.any(String),
      },
    });
  });

  it.each([
    { route: "list" as const, url: "/api/v1/sessions" },
    { route: "detail" as const, url: `/api/v1/sessions/${sessionId}` },
  ])("returns a safe error when the $route repository fails", async (test) => {
    const failure = new Error("sensitive session query failure");
    const routeOptions = createSessionRouteOptions(
      test.route === "list"
        ? {
            listSessionsByInterviewer: vi
              .fn<ListSessionsByInterviewerRepository>()
              .mockRejectedValue(failure),
          }
        : {
            findSessionByIdForInterviewer: vi
              .fn<FindSessionByIdForInterviewerRepository>()
              .mockRejectedValue(failure),
          },
    );
    const { app } = buildSessionApp({ routeOptions });

    const response = await app.inject({
      method: "GET",
      url: test.url,
      headers: authorization,
    });

    expect(response.statusCode).toBe(500);
    expect(apiErrorSchema.safeParse(response.json()).success).toBe(true);
    expect(response.body).not.toContain("sensitive session query failure");
  });

  it("rejects session responses that violate their contract", async () => {
    const invalidSummary = {
      ...sessionSummary,
      status: "unknown",
    } as unknown as SessionSummary;
    const routeOptions = createSessionRouteOptions({
      listSessionsByInterviewer: vi
        .fn<ListSessionsByInterviewerRepository>()
        .mockResolvedValue([invalidSummary]),
    });
    const { app } = buildSessionApp({ routeOptions });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/sessions",
      headers: authorization,
    });

    expect(response.statusCode).toBe(500);
    expect(apiErrorSchema.safeParse(response.json()).success).toBe(true);
    expect(response.body).not.toContain("unknown");
  });
});
