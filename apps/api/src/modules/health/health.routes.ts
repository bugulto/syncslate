import {
  healthResponseSchema,
  readinessResponseSchema,
} from "@syncslate/contracts";
import type { FastifyPluginAsync } from "fastify";

type HealthRoutesOptions = {
  checkReadiness: () => Promise<void>;
};

export const healthRoutes: FastifyPluginAsync<HealthRoutesOptions> = async (
  app,
  options,
) => {
  app.get("/health", async () => {
    return healthResponseSchema.parse({ status: "ok" });
  });

  app.get("/ready", async (request, reply) => {
    try {
      await options.checkReadiness();
      return readinessResponseSchema.parse({ status: "ready" });
    } catch (error) {
      request.log.warn({ err: error }, "Readiness check failed");
      return reply
        .code(503)
        .send(readinessResponseSchema.parse({ status: "not_ready" }));
    }
  });
};
