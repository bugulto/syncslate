import { meResponseSchema, type ApiError } from "@syncslate/contracts";
import type { FastifyPluginAsync } from "fastify";

import type { ProfileBootstrapService } from "./profile-bootstrap.js";

export type AuthRoutesOptions = {
  bootstrapProfile: ProfileBootstrapService;
};

export const authRoutes: FastifyPluginAsync<AuthRoutesOptions> = async (
  app,
  options,
) => {
  app.get(
    "/me",
    {
      preHandler: app.authenticate,
    },
    async (request, reply) => {
      try {
        const authenticatedUser = request.authenticatedUser;

        if (!authenticatedUser) {
          throw new Error("Authenticated user missing after authentication");
        }

        const user = await options.bootstrapProfile(authenticatedUser);

        return meResponseSchema.parse({ user });
      } catch (error) {
        request.log.error({ err: error }, "Current user lookup failed");

        const body = {
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "Unable to load the current user.",
            requestId: request.id,
          },
        } satisfies ApiError;

        return reply.code(500).send(body);
      }
    },
  );
};
