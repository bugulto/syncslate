import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import fastifyPlugin from "fastify-plugin";

import type { AccessTokenVerifier } from "../modules/auth/access-token-verifier.js";
import type { AuthPrincipal } from "../modules/auth/auth-principal.js";
import { extractBearerToken } from "../modules/auth/bearer-token.js";

type Authenticate = (
  request: FastifyRequest,
  reply: FastifyReply,
) => Promise<void>;

declare module "fastify" {
  interface FastifyRequest {
    authPrincipal: AuthPrincipal | null;
  }

  interface FastifyInstance {
    authenticate: Authenticate;
  }
}

export type AuthenticationPluginOptions = {
  verifyAccessToken: AccessTokenVerifier;
};

const registerAuthentication: FastifyPluginAsync<
  AuthenticationPluginOptions
> = async (app, options) => {
  app.decorateRequest("authPrincipal", null);

  app.decorate("authenticate", async (request, reply) => {
    const accessToken = extractBearerToken(request.headers.authorization);

    if (!accessToken) {
      await reply.code(401).send();
      return;
    }

    const principal = await options.verifyAccessToken(accessToken);

    if (!principal) {
      await reply.code(401).send();
      return;
    }

    request.authPrincipal = principal;
  });
};

export const authenticationPlugin = fastifyPlugin(registerAuthentication, {
  name: "authentication",
});
