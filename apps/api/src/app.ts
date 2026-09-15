import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import Fastify, { LogController, type FastifyServerOptions } from "fastify";

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
  roomRoutes,
  type RoomRoutesOptions,
} from "./modules/realtime/room.routes.js";
import {
  sessionRoutes,
  type SessionRoutesOptions,
} from "./modules/sessions/session.routes.js";
import { authenticationPlugin } from "./plugins/authentication.js";

type BuildAppOptions = Pick<FastifyServerOptions, "logger"> &
  ProblemRepositoryDependencies & {
    createInvitation: InvitationRoutesOptions["createInvitation"];
    inspectInvitation: InvitationRoutesOptions["inspectInvitation"];
    joinInvitation: InvitationRoutesOptions["joinInvitation"];
    createWaitingSession: SessionRoutesOptions["createWaitingSession"];
    findSessionByIdForInterviewer: SessionRoutesOptions["findSessionByIdForInterviewer"];
    listSessionsByInterviewer: SessionRoutesOptions["listSessionsByInterviewer"];
    revokeInvitation: InvitationRoutesOptions["revokeInvitation"];
    checkReadiness: () => Promise<void>;
    bootstrapProfile: ProfileBootstrapService;
    corsAllowedOrigins: string[];
    verifyAccessToken: AccessTokenVerifier;
    room?: RoomRoutesOptions;
  };

export function buildApp(options: BuildAppOptions) {
  const app = Fastify({
    logController: new LogController({
      disableRequestLogging: (request) =>
        request.url.startsWith("/api/v1/invitations/"),
    }),
    logger: options.logger ?? true,
  });

  app.register(cors, {
    origin: options.corsAllowedOrigins,
  });

  app.register(websocket, {
    options: { maxPayload: 32_768 },
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
    inspectInvitation: options.inspectInvitation,
    joinInvitation: options.joinInvitation,
    revokeInvitation: options.revokeInvitation,
  });

  app.register(sessionRoutes, {
    prefix: "/api/v1",
    bootstrapProfile: options.bootstrapProfile,
    createWaitingSession: options.createWaitingSession,
    findSessionByIdForInterviewer: options.findSessionByIdForInterviewer,
    listSessionsByInterviewer: options.listSessionsByInterviewer,
  });

  if (options.room !== undefined) {
    app.register(roomRoutes, {
      prefix: "/api/v1",
      ...options.room,
    });
  }

  return app;
}
