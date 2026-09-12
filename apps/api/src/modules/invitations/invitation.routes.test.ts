import {
  apiErrorSchema,
  createInvitationResponseSchema,
  inspectInvitationResponseSchema,
  joinInvitationResponseSchema,
  revokeInvitationResponseSchema,
  type InvitationMetadata,
} from "@syncslate/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "../../app.js";
import type { AccessTokenVerifier } from "../auth/access-token-verifier.js";
import type { AuthenticatedUser } from "../auth/authenticated-user.js";
import type { InvitationRoutesOptions } from "./invitation.routes.js";
import type {
  CreateInvitationService,
  InspectInvitationService,
  JoinInvitationService,
  RevokeInvitationService,
} from "./invitation.service.js";

const apps = new Set<ReturnType<typeof buildApp>>();
const userId = "550e8400-e29b-41d4-a716-446655440000";
const sessionId = "30000000-0000-4000-8000-000000000001";
const invitationId = "40000000-0000-4000-8000-000000000001";
const rawToken = "A".repeat(43);
const guestAccessToken = "guest-access-token-".repeat(8);
const authorization = { authorization: "Bearer valid-access-token" };

const authenticatedUser: AuthenticatedUser = {
  principal: { kind: "user", userId },
  email: "interviewer@example.com",
  displayName: "Ada Lovelace",
  avatarUrl: null,
};

const invitation: InvitationMetadata = {
  id: invitationId,
  sessionId,
  expiresAt: "2026-09-20T12:00:00.000Z",
  consumedAt: null,
  revokedAt: null,
  createdAt: "2026-09-19T12:00:00.000Z",
};

const revokedInvitation = {
  ...invitation,
  revokedAt: "2026-09-19T13:00:00.000Z",
};

const participant = {
  id: "50000000-0000-4000-8000-000000000001",
  displayName: "Grace Hopper",
  role: "candidate" as const,
};

const preview = {
  session: {
    title: "Backend interview",
    status: "waiting" as const,
    language: "typescript" as const,
    durationSeconds: 3_600,
    problem: { title: "Two Sum", difficulty: "easy" as const },
  },
  expiresAt: "2026-09-20T12:00:00.000Z",
};

function createInvitationRouteOptions(
  overrides: Partial<InvitationRoutesOptions> = {},
): InvitationRoutesOptions {
  return {
    createInvitation: vi
      .fn<CreateInvitationService>()
      .mockResolvedValue({ kind: "created", invitation, rawToken }),
    inspectInvitation: vi
      .fn<InspectInvitationService>()
      .mockResolvedValue({ kind: "available", invitation: preview }),
    joinInvitation: vi.fn<JoinInvitationService>().mockResolvedValue({
      kind: "joined",
      participant,
      guestAccessToken,
      expiresAt: "2026-09-19T12:30:00.000Z",
    }),
    revokeInvitation: vi
      .fn<RevokeInvitationService>()
      .mockResolvedValue({ kind: "revoked", invitation: revokedInvitation }),
    ...overrides,
  };
}

function buildInvitationApp(options?: {
  routeOptions?: InvitationRoutesOptions;
  verifyAccessToken?: AccessTokenVerifier;
}) {
  const routeOptions = options?.routeOptions ?? createInvitationRouteOptions();
  const verifyAccessToken =
    options?.verifyAccessToken ??
    vi.fn<AccessTokenVerifier>().mockResolvedValue(authenticatedUser);
  const app = buildApp({
    logger: false,
    corsAllowedOrigins: ["http://localhost:3000"],
    checkReadiness: vi.fn(async () => undefined),
    bootstrapProfile: vi.fn(),
    createWaitingSession: vi.fn(async () => ({
      kind: "problem_not_found" as const,
    })),
    findSessionByIdForInterviewer: vi.fn(async () => null),
    findVisibleProblemById: vi.fn(async () => null),
    listSessionsByInterviewer: vi.fn(async () => []),
    searchVisibleProblems: vi.fn(async () => []),
    verifyAccessToken,
    ...routeOptions,
  });
  apps.add(app);

  return { app, routeOptions };
}

afterEach(async () => {
  await Promise.all([...apps].map((app) => app.close()));
  apps.clear();
  vi.clearAllMocks();
});

describe("invitation routes", () => {
  it("publicly inspects a valid invitation without consuming it", async () => {
    const routeOptions = createInvitationRouteOptions();
    const { app } = buildInvitationApp({ routeOptions });

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/invitations/${rawToken}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(inspectInvitationResponseSchema.parse(response.json())).toEqual({
      invitation: preview,
    });
    expect(routeOptions.inspectInvitation).toHaveBeenCalledWith({ rawToken });
    expect(routeOptions.joinInvitation).not.toHaveBeenCalled();
  });

  it("joins with a bounded display name and returns a no-store credential", async () => {
    const routeOptions = createInvitationRouteOptions();
    const { app } = buildInvitationApp({ routeOptions });

    const response = await app.inject({
      method: "POST",
      url: `/api/v1/invitations/${rawToken}/join`,
      payload: { displayName: "  Grace Hopper  " },
    });

    expect(response.statusCode).toBe(201);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(joinInvitationResponseSchema.parse(response.json())).toEqual({
      participant,
      guestAccessToken,
      expiresAt: "2026-09-19T12:30:00.000Z",
    });
    expect(routeOptions.joinInvitation).toHaveBeenCalledWith({
      rawToken,
      displayName: "Grace Hopper",
    });
  });

  it.each([
    ["not_found", 404, "NOT_FOUND"],
    ["expired", 404, "NOT_FOUND"],
    ["revoked", 404, "NOT_FOUND"],
    ["consumed", 404, "NOT_FOUND"],
    ["session_closed", 409, "CONFLICT"],
    ["session_full", 409, "CONFLICT"],
  ] as const)(
    "maps an unavailable %s invitation to a safe response",
    async (kind, status, code) => {
      const routeOptions = createInvitationRouteOptions({
        inspectInvitation: vi
          .fn<InspectInvitationService>()
          .mockResolvedValue({ kind }),
      });
      const { app } = buildInvitationApp({ routeOptions });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/invitations/${rawToken}`,
      });

      expect(response.statusCode).toBe(status);
      expect(response.headers["cache-control"]).toBe("no-store");
      expect(apiErrorSchema.parse(response.json())).toMatchObject({
        error: { code },
      });
      expect(response.body).not.toContain(rawToken);
    },
  );

  it("rejects malformed public input before calling admission services", async () => {
    const routeOptions = createInvitationRouteOptions();
    const { app } = buildInvitationApp({ routeOptions });

    const inspectResponse = await app.inject({
      method: "GET",
      url: "/api/v1/invitations/short",
    });
    const joinResponse = await app.inject({
      method: "POST",
      url: `/api/v1/invitations/${rawToken}/join`,
      payload: { displayName: "x" },
    });

    expect(inspectResponse.statusCode).toBe(400);
    expect(joinResponse.statusCode).toBe(400);
    expect(routeOptions.inspectInvitation).not.toHaveBeenCalled();
    expect(routeOptions.joinInvitation).not.toHaveBeenCalled();
  });

  it("rejects oversized join payloads with a safe no-store error", async () => {
    const routeOptions = createInvitationRouteOptions();
    const { app } = buildInvitationApp({ routeOptions });

    const response = await app.inject({
      method: "POST",
      url: `/api/v1/invitations/${rawToken}/join`,
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ displayName: "x".repeat(3_000) }),
    });

    expect(response.statusCode).toBe(413);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(apiErrorSchema.parse(response.json())).toMatchObject({
      error: { code: "VALIDATION_ERROR" },
    });
    expect(routeOptions.joinInvitation).not.toHaveBeenCalled();
  });

  it("bounds repeated public invitation attempts", async () => {
    const { app } = buildInvitationApp();

    for (let attempt = 0; attempt < 30; attempt += 1) {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/invitations/${rawToken}`,
      });
      expect(response.statusCode).toBe(200);
    }

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/invitations/${rawToken}`,
    });
    expect(response.statusCode).toBe(429);
    expect(apiErrorSchema.parse(response.json())).toMatchObject({
      error: { code: "RATE_LIMITED" },
    });
  });

  it.each([
    `/api/v1/sessions/${sessionId}/invitations`,
    `/api/v1/sessions/${sessionId}/invitations/revoke`,
  ])("requires authentication for POST %s", async (url) => {
    const routeOptions = createInvitationRouteOptions();
    const { app } = buildInvitationApp({
      routeOptions,
      verifyAccessToken: vi.fn<AccessTokenVerifier>(),
    });

    const response = await app.inject({ method: "POST", url });

    expect(response.statusCode).toBe(401);
    expect(apiErrorSchema.safeParse(response.json()).success).toBe(true);
    expect(routeOptions.createInvitation).not.toHaveBeenCalled();
    expect(routeOptions.revokeInvitation).not.toHaveBeenCalled();
  });

  it.each(["invitations", "invitations/revoke"])(
    "rejects malformed session IDs for %s",
    async (path) => {
      const routeOptions = createInvitationRouteOptions();
      const { app } = buildInvitationApp({ routeOptions });

      const response = await app.inject({
        method: "POST",
        url: `/api/v1/sessions/not-a-uuid/${path}`,
        headers: authorization,
      });

      expect(response.statusCode).toBe(400);
      expect(apiErrorSchema.parse(response.json())).toMatchObject({
        error: { code: "VALIDATION_ERROR" },
      });
      expect(routeOptions.createInvitation).not.toHaveBeenCalled();
      expect(routeOptions.revokeInvitation).not.toHaveBeenCalled();
    },
  );

  it("creates an invitation and returns its raw token exactly once", async () => {
    const routeOptions = createInvitationRouteOptions();
    const { app } = buildInvitationApp({ routeOptions });

    const response = await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${sessionId}/invitations`,
      headers: authorization,
    });

    expect(response.statusCode).toBe(201);
    expect(createInvitationResponseSchema.parse(response.json())).toEqual({
      invitation,
      rawToken,
    });
    expect(response.body.split(rawToken)).toHaveLength(2);
    expect(response.body).not.toContain("tokenHash");
    expect(routeOptions.createInvitation).toHaveBeenCalledWith({
      interviewerId: userId,
      sessionId,
    });
  });

  it("returns a safe 404 for a missing or cross-user session", async () => {
    const routeOptions = createInvitationRouteOptions({
      createInvitation: vi
        .fn<CreateInvitationService>()
        .mockResolvedValue({ kind: "session_not_found" }),
    });
    const { app } = buildInvitationApp({ routeOptions });

    const response = await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${sessionId}/invitations`,
      headers: authorization,
    });

    expect(response.statusCode).toBe(404);
    expect(apiErrorSchema.parse(response.json())).toMatchObject({
      error: { code: "NOT_FOUND", message: "Session not found." },
    });
  });

  it("revokes active invitations for the authenticated owner", async () => {
    const routeOptions = createInvitationRouteOptions();
    const { app } = buildInvitationApp({ routeOptions });

    const response = await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${sessionId}/invitations/revoke`,
      headers: authorization,
    });

    expect(response.statusCode).toBe(200);
    expect(revokeInvitationResponseSchema.parse(response.json())).toEqual({
      invitation: revokedInvitation,
    });
    expect(response.body).not.toContain("tokenHash");
    expect(routeOptions.revokeInvitation).toHaveBeenCalledWith({
      interviewerId: userId,
      sessionId,
    });
  });

  it("returns a safe 404 when no owned active invitation exists", async () => {
    const routeOptions = createInvitationRouteOptions({
      revokeInvitation: vi
        .fn<RevokeInvitationService>()
        .mockResolvedValue({ kind: "invitation_not_found" }),
    });
    const { app } = buildInvitationApp({ routeOptions });

    const response = await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${sessionId}/invitations/revoke`,
      headers: authorization,
    });

    expect(response.statusCode).toBe(404);
    expect(apiErrorSchema.parse(response.json())).toMatchObject({
      error: { code: "NOT_FOUND", message: "Active invitation not found." },
    });
  });

  it.each(["create", "revoke"] as const)(
    "returns a safe error when %s fails",
    async (operation) => {
      const failure = new Error("sensitive invitation failure");
      const routeOptions = createInvitationRouteOptions(
        operation === "create"
          ? {
              createInvitation: vi
                .fn<CreateInvitationService>()
                .mockRejectedValue(failure),
            }
          : {
              revokeInvitation: vi
                .fn<RevokeInvitationService>()
                .mockRejectedValue(failure),
            },
      );
      const { app } = buildInvitationApp({ routeOptions });
      const suffix =
        operation === "create" ? "invitations" : "invitations/revoke";

      const response = await app.inject({
        method: "POST",
        url: `/api/v1/sessions/${sessionId}/${suffix}`,
        headers: authorization,
      });

      expect(response.statusCode).toBe(500);
      expect(apiErrorSchema.parse(response.json())).toMatchObject({
        error: { code: "INTERNAL_SERVER_ERROR" },
      });
      expect(response.body).not.toContain("sensitive invitation failure");
    },
  );

  it("returns a safe error when service output violates the contract", async () => {
    const routeOptions = createInvitationRouteOptions({
      createInvitation: vi
        .fn<CreateInvitationService>()
        .mockResolvedValue({ kind: "created", invitation, rawToken: "short" }),
    });
    const { app } = buildInvitationApp({ routeOptions });

    const response = await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${sessionId}/invitations`,
      headers: authorization,
    });

    expect(response.statusCode).toBe(500);
    expect(apiErrorSchema.safeParse(response.json()).success).toBe(true);
    expect(response.body).not.toContain("short");
  });
});
