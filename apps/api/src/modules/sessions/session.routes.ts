import {
  createSessionRequestSchema,
  createSessionResponseSchema,
  getSessionResponseSchema,
  listSessionsResponseSchema,
  sessionParamsSchema,
  type ApiError,
  type ApiErrorCode,
  type CreateSessionRequest,
  type SessionParams,
} from "@syncslate/contracts";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";

import type { AuthenticatedUser } from "../auth/authenticated-user.js";
import type { ProfileBootstrapService } from "../auth/profile-bootstrap.js";
import type {
  FindSessionByIdForInterviewerRepository,
  ListSessionsByInterviewerRepository,
} from "./session.dependencies.js";
import type { CreateWaitingSessionService } from "./session.service.js";

export type SessionRoutesOptions = {
  bootstrapProfile: ProfileBootstrapService;
  createWaitingSession: CreateWaitingSessionService;
  findSessionByIdForInterviewer: FindSessionByIdForInterviewerRepository;
  listSessionsByInterviewer: ListSessionsByInterviewerRepository;
};

type SessionErrorStatus = 400 | 404 | 500;

function sendSessionError(
  request: FastifyRequest,
  reply: FastifyReply,
  status: SessionErrorStatus,
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

function authenticatedUser(request: FastifyRequest): AuthenticatedUser {
  const user = request.authenticatedUser;

  if (user === null) {
    throw new Error("Authenticated user missing after authentication");
  }

  return user;
}

export const sessionRoutes: FastifyPluginAsync<SessionRoutesOptions> = async (
  app,
  options,
) => {
  app.post<{ Body: CreateSessionRequest }>(
    "/sessions",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const bodyResult = createSessionRequestSchema.safeParse(request.body);

      if (!bodyResult.success) {
        return sendSessionError(
          request,
          reply,
          400,
          "VALIDATION_ERROR",
          "Invalid session creation request.",
        );
      }

      try {
        const user = authenticatedUser(request);
        await options.bootstrapProfile(user);

        const result = await options.createWaitingSession({
          interviewerId: user.principal.userId,
          ...bodyResult.data,
        });

        if (result.kind === "problem_not_found") {
          return sendSessionError(
            request,
            reply,
            404,
            "NOT_FOUND",
            "Problem not found.",
          );
        }

        if (result.kind === "unsupported_language") {
          return sendSessionError(
            request,
            reply,
            400,
            "VALIDATION_ERROR",
            "Selected language is not available for this problem.",
          );
        }

        const body = createSessionResponseSchema.parse({
          session: result.session,
        });

        return reply.code(201).send(body);
      } catch (error) {
        request.log.error({ err: error }, "Session creation failed");
        return sendSessionError(
          request,
          reply,
          500,
          "INTERNAL_SERVER_ERROR",
          "Unable to create the session.",
        );
      }
    },
  );

  app.get(
    "/sessions",
    { preHandler: app.authenticate },
    async (request, reply) => {
      try {
        const user = authenticatedUser(request);
        const sessions = await options.listSessionsByInterviewer({
          interviewerId: user.principal.userId,
        });

        return listSessionsResponseSchema.parse({ sessions });
      } catch (error) {
        request.log.error({ err: error }, "Session list lookup failed");
        return sendSessionError(
          request,
          reply,
          500,
          "INTERNAL_SERVER_ERROR",
          "Unable to load sessions.",
        );
      }
    },
  );

  app.get<{ Params: SessionParams }>(
    "/sessions/:sessionId",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const paramsResult = sessionParamsSchema.safeParse(request.params);

      if (!paramsResult.success) {
        return sendSessionError(
          request,
          reply,
          400,
          "VALIDATION_ERROR",
          "Invalid session ID.",
        );
      }

      try {
        const user = authenticatedUser(request);
        const session = await options.findSessionByIdForInterviewer({
          interviewerId: user.principal.userId,
          sessionId: paramsResult.data.sessionId,
        });

        if (session === null) {
          return sendSessionError(
            request,
            reply,
            404,
            "NOT_FOUND",
            "Session not found.",
          );
        }

        return getSessionResponseSchema.parse({ session });
      } catch (error) {
        request.log.error({ err: error }, "Session detail lookup failed");
        return sendSessionError(
          request,
          reply,
          500,
          "INTERNAL_SERVER_ERROR",
          "Unable to load the session.",
        );
      }
    },
  );
};
