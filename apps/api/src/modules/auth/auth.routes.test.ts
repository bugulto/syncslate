import {
  apiErrorSchema,
  meResponseSchema,
  type CurrentUser,
} from "@syncslate/contracts";
import type { Profile } from "@syncslate/database";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "../../app.js";
import type { AccessTokenVerifier } from "./access-token-verifier.js";
import type { AuthenticatedUser } from "./authenticated-user.js";
import {
  createProfileBootstrapService,
  type ProfileBootstrapService,
} from "./profile-bootstrap.js";

const apps = new Set<ReturnType<typeof buildApp>>();
const userId = "550e8400-e29b-41d4-a716-446655440000";

const authenticatedUser: AuthenticatedUser = {
  principal: { kind: "user", userId },
  email: "ada@example.com",
  displayName: "Ada Lovelace",
  avatarUrl: null,
};

const currentUser: CurrentUser = {
  id: userId,
  email: "ada@example.com",
  displayName: "Ada Lovelace",
  avatarUrl: null,
};

function buildMeApp(options: {
  verifyAccessToken: AccessTokenVerifier;
  bootstrapProfile: ProfileBootstrapService;
}) {
  const app = buildApp({
    logger: false,
    corsAllowedOrigins: ["http://localhost:3000"],
    checkReadiness: vi.fn(async () => undefined),
    verifyAccessToken: options.verifyAccessToken,
    bootstrapProfile: options.bootstrapProfile,
  });
  apps.add(app);

  return app;
}

afterEach(async () => {
  await Promise.all([...apps].map((app) => app.close()));
  apps.clear();
  vi.clearAllMocks();
});

describe("GET /api/v1/me", () => {
  it("returns unauthorized when the bearer token is missing", async () => {
    const verifyAccessToken = vi.fn<AccessTokenVerifier>();
    const bootstrapProfile = vi.fn<ProfileBootstrapService>();
    const app = buildMeApp({ verifyAccessToken, bootstrapProfile });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/me",
    });

    expect(response.statusCode).toBe(401);
    expect(apiErrorSchema.safeParse(response.json()).success).toBe(true);
    expect(response.headers["www-authenticate"]).toBe("Bearer");
    expect(verifyAccessToken).not.toHaveBeenCalled();
    expect(bootstrapProfile).not.toHaveBeenCalled();
  });

  it("returns unauthorized when the bearer token is invalid", async () => {
    const verifyAccessToken = vi
      .fn<AccessTokenVerifier>()
      .mockResolvedValue(null);
    const bootstrapProfile = vi.fn<ProfileBootstrapService>();
    const app = buildMeApp({ verifyAccessToken, bootstrapProfile });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/me",
      headers: { authorization: "Bearer invalid-access-token" },
    });

    expect(response.statusCode).toBe(401);
    expect(apiErrorSchema.safeParse(response.json()).success).toBe(true);
    expect(verifyAccessToken).toHaveBeenCalledWith("invalid-access-token");
    expect(bootstrapProfile).not.toHaveBeenCalled();
  });

  it("bootstraps and returns the verified current user", async () => {
    const verifyAccessToken = vi
      .fn<AccessTokenVerifier>()
      .mockResolvedValue(authenticatedUser);
    const bootstrapProfile = vi
      .fn<ProfileBootstrapService>()
      .mockResolvedValue(currentUser);
    const app = buildMeApp({ verifyAccessToken, bootstrapProfile });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/me",
      headers: { authorization: "Bearer valid-access-token" },
    });

    expect(response.statusCode).toBe(200);
    expect(meResponseSchema.parse(response.json())).toEqual({
      user: currentUser,
    });
    expect(verifyAccessToken).toHaveBeenCalledWith("valid-access-token");
    expect(bootstrapProfile).toHaveBeenCalledWith(authenticatedUser);
  });

  it("creates a missing profile once across repeated requests", async () => {
    let storedProfile: Profile | null = null;
    const findProfileByUserId = vi.fn(async () => storedProfile);
    const createProfileIfMissing = vi.fn(async () => {
      storedProfile = {
        id: userId,
        displayName: "Ada Lovelace",
        avatarUrl: null,
        createdAt: new Date("2026-08-28T00:00:00.000Z"),
        updatedAt: new Date("2026-08-28T00:00:00.000Z"),
      };

      return storedProfile;
    });
    const bootstrapProfile = createProfileBootstrapService({
      findProfileByUserId,
      createProfileIfMissing,
      updateProfileMetadata: vi.fn(async () => storedProfile),
    });
    const verifyAccessToken = vi
      .fn<AccessTokenVerifier>()
      .mockResolvedValue(authenticatedUser);
    const app = buildMeApp({ verifyAccessToken, bootstrapProfile });

    const request = {
      method: "GET" as const,
      url: "/api/v1/me",
      headers: { authorization: "Bearer valid-access-token" },
    };
    const firstResponse = await app.inject(request);
    const secondResponse = await app.inject(request);

    expect(firstResponse.statusCode).toBe(200);
    expect(secondResponse.statusCode).toBe(200);
    expect(firstResponse.json()).toEqual(secondResponse.json());
    expect(findProfileByUserId).toHaveBeenCalledTimes(2);
    expect(createProfileIfMissing).toHaveBeenCalledOnce();
  });

  it("does not expose internal authentication fields", async () => {
    const verifyAccessToken = vi
      .fn<AccessTokenVerifier>()
      .mockResolvedValue(authenticatedUser);
    const bootstrapProfile = vi
      .fn<ProfileBootstrapService>()
      .mockResolvedValue(currentUser);
    const app = buildMeApp({ verifyAccessToken, bootstrapProfile });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/me",
      headers: { authorization: "Bearer sensitive-access-token" },
    });

    expect(response.body).not.toContain("sensitive-access-token");
    expect(response.body).not.toContain("principal");
    expect(response.body).not.toContain("kind");
  });

  it("returns a safe internal error when profile bootstrap fails", async () => {
    const verifyAccessToken = vi
      .fn<AccessTokenVerifier>()
      .mockResolvedValue(authenticatedUser);
    const bootstrapProfile = vi
      .fn<ProfileBootstrapService>()
      .mockRejectedValue(new Error("sensitive database connection detail"));
    const app = buildMeApp({ verifyAccessToken, bootstrapProfile });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/me",
      headers: { authorization: "Bearer valid-access-token" },
    });

    expect(response.statusCode).toBe(500);
    expect(apiErrorSchema.parse(response.json())).toEqual({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Unable to load the current user.",
        requestId: expect.any(String),
      },
    });
    expect(response.body).not.toContain("sensitive database connection detail");
  });

  it("returns a safe internal error when the response violates its contract", async () => {
    const verifyAccessToken = vi
      .fn<AccessTokenVerifier>()
      .mockResolvedValue(authenticatedUser);
    const bootstrapProfile = vi
      .fn<ProfileBootstrapService>()
      .mockResolvedValue({
        ...currentUser,
        displayName: "Al",
      });
    const app = buildMeApp({ verifyAccessToken, bootstrapProfile });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/me",
      headers: { authorization: "Bearer valid-access-token" },
    });

    expect(response.statusCode).toBe(500);
    expect(apiErrorSchema.safeParse(response.json()).success).toBe(true);
    expect(response.body).not.toContain("Al");
  });
});
