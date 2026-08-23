import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AccessTokenVerifier } from "../modules/auth/access-token-verifier.js";
import { authenticationPlugin } from "./authentication.js";

const apps = new Set<FastifyInstance>();

afterEach(async () => {
  await Promise.all([...apps].map((app) => app.close()));
  apps.clear();
});

function buildProtectedApp(verifyAccessToken: AccessTokenVerifier) {
  const app = Fastify({ logger: false });
  const handler = vi.fn(async (request: { authPrincipal: unknown }) => ({
    principal: request.authPrincipal,
  }));

  app.register(authenticationPlugin, { verifyAccessToken });
  app.register(async (protectedRoutes) => {
    protectedRoutes.get(
      "/protected",
      { preHandler: protectedRoutes.authenticate },
      handler,
    );
  });
  apps.add(app);

  return { app, handler };
}

describe("authenticationPlugin", () => {
  it("attaches a verified principal and continues to the handler", async () => {
    const verifyAccessToken = vi.fn<AccessTokenVerifier>().mockResolvedValue({
      kind: "user",
      userId: "550e8400-e29b-41d4-a716-446655440000",
    });
    const { app, handler } = buildProtectedApp(verifyAccessToken);

    const response = await app.inject({
      method: "GET",
      url: "/protected",
      headers: { authorization: "Bearer valid-access-token" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      principal: {
        kind: "user",
        userId: "550e8400-e29b-41d4-a716-446655440000",
      },
    });
    expect(verifyAccessToken).toHaveBeenCalledWith("valid-access-token");
    expect(handler).toHaveBeenCalledOnce();
  });

  it("rejects a request without a bearer token", async () => {
    const verifyAccessToken = vi.fn<AccessTokenVerifier>();
    const { app, handler } = buildProtectedApp(verifyAccessToken);

    const response = await app.inject({
      method: "GET",
      url: "/protected",
    });

    expect(response.statusCode).toBe(401);
    expect(verifyAccessToken).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });

  it("rejects a token that cannot be verified", async () => {
    const verifyAccessToken = vi
      .fn<AccessTokenVerifier>()
      .mockResolvedValue(null);
    const { app, handler } = buildProtectedApp(verifyAccessToken);

    const response = await app.inject({
      method: "GET",
      url: "/protected",
      headers: { authorization: "Bearer invalid-access-token" },
    });

    expect(response.statusCode).toBe(401);
    expect(verifyAccessToken).toHaveBeenCalledWith("invalid-access-token");
    expect(handler).not.toHaveBeenCalled();
  });
});
