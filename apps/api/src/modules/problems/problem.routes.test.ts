import {
  apiErrorSchema,
  getProblemResponseSchema,
  listProblemsResponseSchema,
  type ProblemDetail,
  type ProblemSummary,
} from "@syncslate/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "../../app.js";
import type { AccessTokenVerifier } from "../auth/access-token-verifier.js";
import type { ProfileBootstrapService } from "../auth/profile-bootstrap.js";
import type {
  FindVisibleProblemByIdRepository,
  ProblemRepositoryDependencies,
  SearchVisibleProblemsRepository,
} from "./problem.dependencies.js";

const apps = new Set<ReturnType<typeof buildApp>>();
const userId = "550e8400-e29b-41d4-a716-446655440000";
const problemId = "10000000-0000-4000-8000-000000000001";
const authorization = { authorization: "Bearer valid-access-token" };

const problemSummary: ProblemSummary = {
  id: problemId,
  title: "Two Sum",
  slug: "two-sum",
  difficulty: "easy",
  tags: ["arrays", "hash map"],
  visibility: "seeded",
  availableLanguages: ["typescript", "python"],
};

const problemDetail: ProblemDetail = {
  ...problemSummary,
  descriptionMarkdown: "Find two numbers that add up to a target.",
  constraintsMarkdown: null,
  examples: [],
  interviewerNotesMarkdown: null,
  starterCode: [
    { language: "typescript", code: "export function twoSum() {}" },
    { language: "python", code: "def two_sum(): pass" },
  ],
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

const authenticatedUser = {
  principal: { kind: "user" as const, userId },
  email: "interviewer@example.com",
  displayName: "Ada Lovelace",
  avatarUrl: null,
};

function createProblemDependencies(
  overrides: Partial<ProblemRepositoryDependencies> = {},
) {
  return {
    searchVisibleProblems: vi
      .fn<SearchVisibleProblemsRepository>()
      .mockResolvedValue([]),
    findVisibleProblemById: vi
      .fn<FindVisibleProblemByIdRepository>()
      .mockResolvedValue(problemDetail),
    ...overrides,
  } satisfies ProblemRepositoryDependencies;
}

function buildProblemApp(options?: {
  dependencies?: ProblemRepositoryDependencies;
  verifyAccessToken?: AccessTokenVerifier;
}) {
  const dependencies = options?.dependencies ?? createProblemDependencies();
  const verifyAccessToken =
    options?.verifyAccessToken ??
    vi.fn<AccessTokenVerifier>().mockResolvedValue(authenticatedUser);
  const app = buildApp({
    logger: false,
    corsAllowedOrigins: ["http://localhost:3000"],
    checkReadiness: vi.fn(async () => undefined),
    bootstrapProfile: vi.fn<ProfileBootstrapService>(),
    verifyAccessToken,
    ...dependencies,
  });
  apps.add(app);

  return { app, dependencies, verifyAccessToken };
}

afterEach(async () => {
  await Promise.all([...apps].map((app) => app.close()));
  apps.clear();
  vi.clearAllMocks();
});

describe("problem routes", () => {
  it.each(["/api/v1/problems", `/api/v1/problems/${problemId}`])(
    "requires authentication for GET %s",
    async (url) => {
      const dependencies = createProblemDependencies();
      const verifyAccessToken = vi.fn<AccessTokenVerifier>();
      const { app } = buildProblemApp({ dependencies, verifyAccessToken });

      const response = await app.inject({ method: "GET", url });

      expect(response.statusCode).toBe(401);
      expect(apiErrorSchema.safeParse(response.json()).success).toBe(true);
      expect(dependencies.searchVisibleProblems).not.toHaveBeenCalled();
      expect(dependencies.findVisibleProblemById).not.toHaveBeenCalled();
    },
  );

  it("returns an empty problem list with default filters", async () => {
    const dependencies = createProblemDependencies();
    const { app } = buildProblemApp({ dependencies });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/problems",
      headers: authorization,
    });

    expect(response.statusCode).toBe(200);
    expect(listProblemsResponseSchema.parse(response.json())).toEqual({
      problems: [],
    });
    expect(dependencies.searchVisibleProblems).toHaveBeenCalledWith({
      requesterId: userId,
    });
  });

  it("validates, normalizes, and forwards combined problem filters", async () => {
    const searchVisibleProblems = vi
      .fn<SearchVisibleProblemsRepository>()
      .mockResolvedValue([problemSummary]);
    const dependencies = createProblemDependencies({ searchVisibleProblems });
    const { app } = buildProblemApp({ dependencies });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/problems?q=%20sum%20&difficulty=easy&tag=%20arrays%20&language=typescript",
      headers: authorization,
    });

    expect(response.statusCode).toBe(200);
    expect(listProblemsResponseSchema.parse(response.json())).toEqual({
      problems: [problemSummary],
    });
    expect(searchVisibleProblems).toHaveBeenCalledWith({
      requesterId: userId,
      q: "sum",
      difficulty: "easy",
      tag: "arrays",
      language: "typescript",
    });
  });

  it.each([
    "/api/v1/problems?difficulty=expert",
    "/api/v1/problems?unknown=value",
  ])("rejects invalid problem filters: %s", async (url) => {
    const dependencies = createProblemDependencies();
    const { app } = buildProblemApp({ dependencies });

    const response = await app.inject({
      method: "GET",
      url,
      headers: authorization,
    });

    expect(response.statusCode).toBe(400);
    expect(apiErrorSchema.parse(response.json())).toMatchObject({
      error: { code: "VALIDATION_ERROR" },
    });
    expect(dependencies.searchVisibleProblems).not.toHaveBeenCalled();
  });

  it("returns a visible problem detail", async () => {
    const dependencies = createProblemDependencies();
    const { app } = buildProblemApp({ dependencies });

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/problems/${problemId}`,
      headers: authorization,
    });

    expect(response.statusCode).toBe(200);
    expect(getProblemResponseSchema.parse(response.json())).toEqual({
      problem: problemDetail,
    });
    expect(dependencies.findVisibleProblemById).toHaveBeenCalledWith({
      requesterId: userId,
      problemId,
    });
  });

  it("returns a requester-owned private problem detail", async () => {
    const privateProblem: ProblemDetail = {
      ...problemDetail,
      visibility: "private",
      title: "Private Two Sum",
      slug: "private-two-sum",
    };
    const findVisibleProblemById = vi
      .fn<FindVisibleProblemByIdRepository>()
      .mockResolvedValue(privateProblem);
    const dependencies = createProblemDependencies({
      findVisibleProblemById,
    });
    const { app } = buildProblemApp({ dependencies });

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/problems/${problemId}`,
      headers: authorization,
    });

    expect(response.statusCode).toBe(200);
    expect(getProblemResponseSchema.parse(response.json())).toEqual({
      problem: privateProblem,
    });
    expect(findVisibleProblemById).toHaveBeenCalledWith({
      requesterId: userId,
      problemId,
    });
  });

  it("rejects a malformed problem ID before repository access", async () => {
    const dependencies = createProblemDependencies();
    const { app } = buildProblemApp({ dependencies });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/problems/not-a-uuid",
      headers: authorization,
    });

    expect(response.statusCode).toBe(400);
    expect(apiErrorSchema.parse(response.json())).toMatchObject({
      error: { code: "VALIDATION_ERROR" },
    });
    expect(dependencies.findVisibleProblemById).not.toHaveBeenCalled();
  });

  it("returns the same safe 404 for missing or inaccessible problems", async () => {
    const findVisibleProblemById = vi
      .fn<FindVisibleProblemByIdRepository>()
      .mockResolvedValue(null);
    const dependencies = createProblemDependencies({
      findVisibleProblemById,
    });
    const { app } = buildProblemApp({ dependencies });

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/problems/${problemId}`,
      headers: authorization,
    });

    expect(response.statusCode).toBe(404);
    expect(apiErrorSchema.parse(response.json())).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Problem not found.",
        requestId: expect.any(String),
      },
    });
  });

  it("returns a safe error when a repository lookup fails", async () => {
    const searchVisibleProblems = vi
      .fn<SearchVisibleProblemsRepository>()
      .mockRejectedValue(new Error("sensitive database connection detail"));
    const dependencies = createProblemDependencies({ searchVisibleProblems });
    const { app } = buildProblemApp({ dependencies });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/problems",
      headers: authorization,
    });

    expect(response.statusCode).toBe(500);
    expect(apiErrorSchema.parse(response.json())).toMatchObject({
      error: { code: "INTERNAL_SERVER_ERROR" },
    });
    expect(response.body).not.toContain("sensitive database connection detail");
  });

  it("returns a safe error when a detail lookup fails", async () => {
    const findVisibleProblemById = vi
      .fn<FindVisibleProblemByIdRepository>()
      .mockRejectedValue(new Error("sensitive detail query failure"));
    const dependencies = createProblemDependencies({
      findVisibleProblemById,
    });
    const { app } = buildProblemApp({ dependencies });

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/problems/${problemId}`,
      headers: authorization,
    });

    expect(response.statusCode).toBe(500);
    expect(apiErrorSchema.parse(response.json())).toMatchObject({
      error: { code: "INTERNAL_SERVER_ERROR" },
    });
    expect(response.body).not.toContain("sensitive detail query failure");
  });

  it("rejects repository responses that violate the list contract", async () => {
    const invalidSummary = {
      ...problemSummary,
      availableLanguages: [],
    } as unknown as ProblemSummary;
    const searchVisibleProblems = vi
      .fn<SearchVisibleProblemsRepository>()
      .mockResolvedValue([invalidSummary]);
    const dependencies = createProblemDependencies({ searchVisibleProblems });
    const { app } = buildProblemApp({ dependencies });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/problems",
      headers: authorization,
    });

    expect(response.statusCode).toBe(500);
    expect(apiErrorSchema.safeParse(response.json()).success).toBe(true);
    expect(response.body).not.toContain("availableLanguages");
  });

  it("rejects repository responses that violate the detail contract", async () => {
    const invalidDetail = {
      ...problemDetail,
      starterCode: [],
    } as unknown as ProblemDetail;
    const findVisibleProblemById = vi
      .fn<FindVisibleProblemByIdRepository>()
      .mockResolvedValue(invalidDetail);
    const dependencies = createProblemDependencies({
      findVisibleProblemById,
    });
    const { app } = buildProblemApp({ dependencies });

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/problems/${problemId}`,
      headers: authorization,
    });

    expect(response.statusCode).toBe(500);
    expect(apiErrorSchema.safeParse(response.json()).success).toBe(true);
    expect(response.body).not.toContain("starterCode");
  });
});
