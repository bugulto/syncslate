import type { ApiError } from "@syncslate/contracts";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import fastifyPlugin from "fastify-plugin";

import type { AccessTokenVerifier } from "../modules/auth/access-token-verifier.js";
import type { AuthPrincipal } from "../modules/auth/auth-principal.js";
import type { AuthenticatedUser } from "../modules/auth/authenticated-user.js";
import { extractBearerToken } from "../modules/auth/bearer-token.js";

type Authenticate = (
  request: FastifyRequest,
  reply: FastifyReply,
) => Promise<void>;

declare module "fastify" {
  interface FastifyRequest {
    authPrincipal: AuthPrincipal | null;
    authenticatedUser: AuthenticatedUser | null;
  }

  interface FastifyInstance {
    authenticate: Authenticate;
  }
}

export type AuthenticationPluginOptions = {
  verifyAccessToken: AccessTokenVerifier;
};

async function sendUnauthorized(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const body = {
    error: {
      code: "UNAUTHORIZED",
      message: "Authentication required.",
      requestId: request.id,
    },
  } satisfies ApiError;

  await reply.header("www-authenticate", "Bearer").code(401).send(body);
}

const registerAuthentication: FastifyPluginAsync<
  AuthenticationPluginOptions
> = async (app, options) => {
  app.decorateRequest("authPrincipal", null);
  app.decorateRequest("authenticatedUser", null);

  app.decorate("authenticate", async (request, reply) => {
    const accessToken = extractBearerToken(request.headers.authorization);

    if (!accessToken) {
      await sendUnauthorized(request, reply);
      return;
    }

    let authenticatedUser: AuthenticatedUser | null = null;

    try {
      authenticatedUser = await options.verifyAccessToken(accessToken);
    } catch {
      // Authentication failures intentionally share one public response.
    }

    if (!authenticatedUser) {
      await sendUnauthorized(request, reply);
      return;
    }

    request.authenticatedUser = authenticatedUser;
    request.authPrincipal = authenticatedUser.principal;
  });
};

export const authenticationPlugin = fastifyPlugin(registerAuthentication, {
  name: "authentication",
});
