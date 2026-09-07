import cors from "@fastify/cors";
import Fastify, { type FastifyServerOptions } from "fastify";

import type { AccessTokenVerifier } from "./modules/auth/access-token-verifier.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import type { ProfileBootstrapService } from "./modules/auth/profile-bootstrap.js";
import { healthRoutes } from "./modules/health/health.routes.js";
import {
  invitationRoutes,
  type InvitationRoutesOptions,
} from "./modules/invitations/invitation.routes.js";
import type { ProblemRepositoryDependencies } from "./modules/problems/problem.dependencies.js";
import { problemRoutes } from "./modules/problems/problem.routes.js";
import {
  sessionRoutes,
  type SessionRoutesOptions,
} from "./modules/sessions/session.routes.js";
import { authenticationPlugin } from "./plugins/authentication.js";

type BuildAppOptions = Pick<FastifyServerOptions, "logger"> &
  ProblemRepositoryDependencies & {
    createInvitation: InvitationRoutesOptions["createInvitation"];
    createWaitingSession: SessionRoutesOptions["createWaitingSession"];
    findSessionByIdForInterviewer: SessionRoutesOptions["findSessionByIdForInterviewer"];
    listSessionsByInterviewer: SessionRoutesOptions["listSessionsByInterviewer"];
    revokeInvitation: InvitationRoutesOptions["revokeInvitation"];
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

  app.register(problemRoutes, {
    prefix: "/api/v1",
    searchVisibleProblems: options.searchVisibleProblems,
    findVisibleProblemById: options.findVisibleProblemById,
  });

  app.register(invitationRoutes, {
    prefix: "/api/v1",
    createInvitation: options.createInvitation,
    revokeInvitation: options.revokeInvitation,
  });

  app.register(sessionRoutes, {
    prefix: "/api/v1",
    bootstrapProfile: options.bootstrapProfile,
    createWaitingSession: options.createWaitingSession,
    findSessionByIdForInterviewer: options.findSessionByIdForInterviewer,
    listSessionsByInterviewer: options.listSessionsByInterviewer,
  });

  return app;
}
