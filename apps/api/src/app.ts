import Fastify, { type FastifyServerOptions } from "fastify";

import { healthRoutes } from "./modules/health/health.routes.js";

type BuildAppOptions = Pick<FastifyServerOptions, "logger"> & {
  checkReadiness: () => Promise<void>;
};

export function buildApp(options: BuildAppOptions) {
  const app = Fastify({
    logger: options.logger ?? true,
  });

  app.register(healthRoutes, {
    prefix: "/api/v1",
    checkReadiness: options.checkReadiness,
  });

  return app;
}
