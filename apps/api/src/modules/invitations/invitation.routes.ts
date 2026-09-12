import {
  createInvitationResponseSchema,
  inspectInvitationResponseSchema,
  invitationParamsSchema,
  joinInvitationRequestSchema,
  joinInvitationResponseSchema,
  revokeInvitationResponseSchema,
  sessionParamsSchema,
  type ApiError,
  type ApiErrorCode,
  type SessionParams,
  type InvitationParams,
} from "@syncslate/contracts";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";

import { isUserAuthPrincipal } from "../auth/auth-principal.js";
import type {
  CreateInvitationService,
  InspectInvitationService,
  JoinInvitationService,
  RevokeInvitationService,
} from "./invitation.service.js";

export type InvitationRoutesOptions = {
  createInvitation: CreateInvitationService;
  inspectInvitation: InspectInvitationService;
  joinInvitation: JoinInvitationService;
  revokeInvitation: RevokeInvitationService;
};

type InvitationErrorStatus = 400 | 404 | 409 | 413 | 429 | 500;

const PUBLIC_ATTEMPT_WINDOW_MS = 60_000;
const PUBLIC_ATTEMPTS_PER_WINDOW = 30;
const MAX_RATE_LIMIT_KEYS = 10_000;

function createPublicAttemptLimiter(now: () => number = Date.now) {
  const attempts = new Map<
    string,
    { count: number; windowStartedAt: number }
  >();

  return (key: string): boolean => {
    const currentTime = now();
    const current = attempts.get(key);

    if (
      current === undefined ||
      currentTime - current.windowStartedAt >= PUBLIC_ATTEMPT_WINDOW_MS
    ) {
      if (current === undefined && attempts.size >= MAX_RATE_LIMIT_KEYS) {
        for (const [attemptKey, value] of attempts) {
          if (currentTime - value.windowStartedAt >= PUBLIC_ATTEMPT_WINDOW_MS) {
            attempts.delete(attemptKey);
          }
        }
        if (attempts.size >= MAX_RATE_LIMIT_KEYS) {
          return false;
        }
      }
      attempts.set(key, { count: 1, windowStartedAt: currentTime });
      return true;
    }

    if (current.count >= PUBLIC_ATTEMPTS_PER_WINDOW) {
      return false;
    }

    current.count += 1;
    return true;
  };
}

function sendInvitationError(
  request: FastifyRequest,
  reply: FastifyReply,
  status: InvitationErrorStatus,
  code: ApiErrorCode,
  message: string,
) {
  const body = {
    error: {
      code,
      message,
      requestId: request.id,
    },
  } satisfies ApiError;

  return reply.code(status).send(body);
}

function authenticatedUserId(request: FastifyRequest): string {
  const principal = request.authPrincipal;

  if (!isUserAuthPrincipal(principal)) {
    throw new Error("Authenticated user principal required");
  }

  return principal.userId;
}

export const invitationRoutes: FastifyPluginAsync<
  InvitationRoutesOptions
> = async (app, options) => {
  const acceptPublicAttempt = createPublicAttemptLimiter();
  const setNoStore = async (_request: FastifyRequest, reply: FastifyReply) => {
    reply.header("cache-control", "no-store");
  };

  app.get<{ Params: InvitationParams }>(
    "/invitations/:rawToken",
    { onRequest: setNoStore },
    async (request, reply) => {
      if (!acceptPublicAttempt(request.ip)) {
        return sendInvitationError(
          request,
          reply,
          429,
          "RATE_LIMITED",
          "Too many invitation attempts. Try again later.",
        );
      }

      const paramsResult = invitationParamsSchema.safeParse(request.params);
      if (!paramsResult.success) {
        return sendInvitationError(
          request,
          reply,
          400,
          "VALIDATION_ERROR",
          "Invalid invitation token.",
        );
      }

      try {
        const result = await options.inspectInvitation(paramsResult.data);
        if (result.kind === "session_full") {
          return sendInvitationError(
            request,
            reply,
            409,
            "CONFLICT",
            "The session already has a candidate.",
          );
        }
        if (result.kind === "session_closed") {
          return sendInvitationError(
            request,
            reply,
            409,
            "CONFLICT",
            "The session is not accepting candidates.",
          );
        }
        if (result.kind !== "available") {
          return sendInvitationError(
            request,
            reply,
            404,
            "NOT_FOUND",
            "Invitation is unavailable.",
          );
        }

        return inspectInvitationResponseSchema.parse({
          invitation: result.invitation,
        });
      } catch (error) {
        request.log.error({ err: error }, "Invitation inspection failed");
        return sendInvitationError(
          request,
          reply,
          500,
          "INTERNAL_SERVER_ERROR",
          "Unable to inspect the invitation.",
        );
      }
    },
  );

  app.post<{ Params: InvitationParams; Body: unknown }>(
    "/invitations/:rawToken/join",
    {
      bodyLimit: 2_048,
      onRequest: setNoStore,
      errorHandler(error, request, reply) {
        const status = error.statusCode === 413 ? 413 : 400;
        return sendInvitationError(
          request,
          reply,
          status,
          "VALIDATION_ERROR",
          status === 413
            ? "Invitation join payload is too large."
            : "Invalid invitation join request.",
        );
      },
    },
    async (request, reply) => {
      if (!acceptPublicAttempt(request.ip)) {
        return sendInvitationError(
          request,
          reply,
          429,
          "RATE_LIMITED",
          "Too many invitation attempts. Try again later.",
        );
      }

      const paramsResult = invitationParamsSchema.safeParse(request.params);
      const bodyResult = joinInvitationRequestSchema.safeParse(request.body);
      if (!paramsResult.success || !bodyResult.success) {
        return sendInvitationError(
          request,
          reply,
          400,
          "VALIDATION_ERROR",
          "Invalid invitation token or display name.",
        );
      }

      try {
        const result = await options.joinInvitation({
          rawToken: paramsResult.data.rawToken,
          displayName: bodyResult.data.displayName,
        });
        if (result.kind === "session_full") {
          return sendInvitationError(
            request,
            reply,
            409,
            "CONFLICT",
            "The session already has a candidate.",
          );
        }
        if (result.kind === "session_closed") {
          return sendInvitationError(
            request,
            reply,
            409,
            "CONFLICT",
            "The session is not accepting candidates.",
          );
        }
        if (result.kind !== "joined") {
          return sendInvitationError(
            request,
            reply,
            404,
            "NOT_FOUND",
            "Invitation is unavailable.",
          );
        }

        const body = joinInvitationResponseSchema.parse({
          participant: result.participant,
          guestAccessToken: result.guestAccessToken,
          expiresAt: result.expiresAt,
        });
        return reply.code(201).send(body);
      } catch (error) {
        request.log.error({ err: error }, "Invitation join failed");
        return sendInvitationError(
          request,
          reply,
          500,
          "INTERNAL_SERVER_ERROR",
          "Unable to join the session.",
        );
      }
    },
  );

  app.post<{ Params: SessionParams }>(
    "/sessions/:sessionId/invitations",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const paramsResult = sessionParamsSchema.safeParse(request.params);

      if (!paramsResult.success) {
        return sendInvitationError(
          request,
          reply,
          400,
          "VALIDATION_ERROR",
          "Invalid session ID.",
        );
      }

      try {
        const result = await options.createInvitation({
          interviewerId: authenticatedUserId(request),
          sessionId: paramsResult.data.sessionId,
        });

        if (result.kind === "session_not_found") {
          return sendInvitationError(
            request,
            reply,
            404,
            "NOT_FOUND",
            "Session not found.",
          );
        }

        const body = createInvitationResponseSchema.parse({
          invitation: result.invitation,
          rawToken: result.rawToken,
        });

        return reply.code(201).send(body);
      } catch (error) {
        request.log.error({ err: error }, "Invitation creation failed");
        return sendInvitationError(
          request,
          reply,
          500,
          "INTERNAL_SERVER_ERROR",
          "Unable to create the invitation.",
        );
      }
    },
  );

  app.post<{ Params: SessionParams }>(
    "/sessions/:sessionId/invitations/revoke",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const paramsResult = sessionParamsSchema.safeParse(request.params);

      if (!paramsResult.success) {
        return sendInvitationError(
          request,
          reply,
          400,
          "VALIDATION_ERROR",
          "Invalid session ID.",
        );
      }

      try {
        const result = await options.revokeInvitation({
          interviewerId: authenticatedUserId(request),
          sessionId: paramsResult.data.sessionId,
        });

        if (result.kind === "invitation_not_found") {
          return sendInvitationError(
            request,
            reply,
            404,
            "NOT_FOUND",
            "Active invitation not found.",
          );
        }

        return revokeInvitationResponseSchema.parse({
          invitation: result.invitation,
        });
      } catch (error) {
        request.log.error({ err: error }, "Invitation revocation failed");
        return sendInvitationError(
          request,
          reply,
          500,
          "INTERNAL_SERVER_ERROR",
          "Unable to revoke the invitation.",
        );
      }
    },
  );
};
