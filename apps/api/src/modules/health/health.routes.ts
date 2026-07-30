import { healthResponseSchema } from "@syncslate/contracts";
import type { FastifyPluginAsync } from "fastify";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/health", async () => {
    return healthResponseSchema.parse({ status: "ok" });
  });
};
