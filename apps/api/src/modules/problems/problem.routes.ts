import {
  getProblemResponseSchema,
  listProblemsQuerySchema,
  listProblemsResponseSchema,
  problemParamsSchema,
  type ApiError,
  type ApiErrorCode,
  type ListProblemsQuery,
  type ProblemParams,
} from "@syncslate/contracts";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";

import type { ProblemRepositoryDependencies } from "./problem.dependencies.js";

export type ProblemRoutesOptions = ProblemRepositoryDependencies;

type ProblemErrorStatus = 400 | 404 | 500;

function sendProblemError(
  request: FastifyRequest,
  reply: FastifyReply,
  status: ProblemErrorStatus,
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

export const problemRoutes: FastifyPluginAsync<ProblemRoutesOptions> = async (
  app,
  options,
) => {
  app.get<{ Querystring: ListProblemsQuery }>(
    "/problems",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const queryResult = listProblemsQuerySchema.safeParse(request.query);

      if (!queryResult.success) {
        return sendProblemError(
          request,
          reply,
          400,
          "VALIDATION_ERROR",
          "Invalid problem filters.",
        );
      }

      try {
        const requesterId = authenticatedUserId(request);
        const problems = await options.searchVisibleProblems({
          requesterId,
          ...queryResult.data,
        });

        return listProblemsResponseSchema.parse({ problems });
      } catch (error) {
        request.log.error({ err: error }, "Problem list lookup failed");
        return sendProblemError(
          request,
          reply,
          500,
          "INTERNAL_SERVER_ERROR",
          "Unable to load problems.",
        );
      }
    },
  );

  app.get<{ Params: ProblemParams }>(
    "/problems/:problemId",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const paramsResult = problemParamsSchema.safeParse(request.params);

      if (!paramsResult.success) {
        return sendProblemError(
          request,
          reply,
          400,
          "VALIDATION_ERROR",
          "Invalid problem ID.",
        );
      }

      try {
        const requesterId = authenticatedUserId(request);
        const problem = await options.findVisibleProblemById({
          requesterId,
          problemId: paramsResult.data.problemId,
        });

        if (problem === null) {
          return sendProblemError(
            request,
            reply,
            404,
            "NOT_FOUND",
            "Problem not found.",
          );
        }

        return getProblemResponseSchema.parse({ problem });
      } catch (error) {
        request.log.error({ err: error }, "Problem detail lookup failed");
        return sendProblemError(
          request,
          reply,
          500,
          "INTERNAL_SERVER_ERROR",
          "Unable to load the problem.",
        );
      }
    },
  );
};
