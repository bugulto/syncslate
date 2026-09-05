import type { ListProblemsQuery, ProblemParams } from "@syncslate/contracts";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";

import type { ProblemRepositoryDependencies } from "./problem.dependencies.js";

export type ProblemRoutesOptions = ProblemRepositoryDependencies;

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
    async (request) => {
      const requesterId = authenticatedUserId(request);
      const problems = await options.searchVisibleProblems({
        requesterId,
        ...request.query,
      });

      return { problems };
    },
  );

  app.get<{ Params: ProblemParams }>(
    "/problems/:problemId",
    { preHandler: app.authenticate },
    async (request) => {
      const requesterId = authenticatedUserId(request);
      const problem = await options.findVisibleProblemById({
        requesterId,
        problemId: request.params.problemId,
      });

      return { problem };
    },
  );
};
