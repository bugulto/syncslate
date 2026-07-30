import Fastify from "fastify";

import { healthRoutes } from "./modules/health/health.routes.js";

type BuildAppOptions = {
  logger?: boolean;
};

export function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify({
    logger: options.logger ?? true,
  });

  app.register(healthRoutes, { prefix: "/api/v1" });

  return app;
}
