import {
  createInvitationResponseSchema,
  revokeInvitationResponseSchema,
  sessionParamsSchema,
  type ApiError,
  type ApiErrorCode,
  type SessionParams,
} from "@syncslate/contracts";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";

import type {
  CreateInvitationService,
  RevokeInvitationService,
} from "./invitation.service.js";

export type InvitationRoutesOptions = {
  createInvitation: CreateInvitationService;
  revokeInvitation: RevokeInvitationService;
};

type InvitationErrorStatus = 400 | 404 | 500;

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

  if (principal === null) {
    throw new Error("Authenticated principal missing after authentication");
  }

  return principal.userId;
}

export const invitationRoutes: FastifyPluginAsync<
  InvitationRoutesOptions
> = async (app, options) => {
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
