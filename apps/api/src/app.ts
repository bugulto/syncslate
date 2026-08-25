import cors from "@fastify/cors";
import Fastify, { type FastifyServerOptions } from "fastify";

import type { AccessTokenVerifier } from "./modules/auth/access-token-verifier.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import type { ProfileBootstrapService } from "./modules/auth/profile-bootstrap.js";
import { healthRoutes } from "./modules/health/health.routes.js";
import { authenticationPlugin } from "./plugins/authentication.js";

type BuildAppOptions = Pick<FastifyServerOptions, "logger"> & {
  checkReadiness: () => Promise<void>;
  bootstrapProfile: ProfileBootstrapService;
  corsAllowedOrigins: string[];
  verifyAccessToken: AccessTokenVerifier;
};

export function buildApp(options: BuildAppOptions) {
  const app = Fastify({
    logger: options.logger ?? true,
  });

  app.register(cors, {
    origin: options.corsAllowedOrigins,
  });

  app.register(authenticationPlugin, {
    verifyAccessToken: options.verifyAccessToken,
  });

  app.register(authRoutes, {
    prefix: "/api/v1",
    bootstrapProfile: options.bootstrapProfile,
  });

  app.register(healthRoutes, {
    prefix: "/api/v1",
    checkReadiness: options.checkReadiness,
  });

  return app;
}
