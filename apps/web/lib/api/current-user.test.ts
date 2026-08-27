import { meResponseSchema, type CurrentUser } from "@syncslate/contracts";
import { describe, expect, it, vi } from "vitest";

import {
  createAuthenticatedApiClient,
  type AuthenticatedApiClient,
} from "./client";
import { getCurrentUser } from "./current-user";
import {
  ApiRequestError,
  AuthenticationRequiredError,
  InvalidApiResponseError,
} from "./errors";

const currentUser: CurrentUser = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  email: "ada@example.com",
  displayName: "Ada Lovelace",
  avatarUrl: "https://example.com/avatar.png",
};

function createMockApiClient(response: { user: CurrentUser }) {
  const request = vi.fn(async () => response);
  const apiClient: AuthenticatedApiClient = {
    request: request as AuthenticatedApiClient["request"],
  };

  return { apiClient, request };
}

describe("getCurrentUser", () => {
  it("requests the uncached current-user endpoint with its shared schema", async () => {
    const { apiClient, request } = createMockApiClient({ user: currentUser });

    await expect(getCurrentUser(apiClient)).resolves.toEqual(currentUser);
    expect(request).toHaveBeenCalledWith("/me", meResponseSchema, {
      method: "GET",
      cache: "no-store",
    });
  });

  it("preserves nullable identity fields", async () => {
    const userWithNullableFields: CurrentUser = {
      ...currentUser,
      email: null,
      avatarUrl: null,
    };
    const { apiClient } = createMockApiClient({
      user: userWithNullableFields,
    });

    await expect(getCurrentUser(apiClient)).resolves.toEqual(
      userWithNullableFields,
    );
  });

  it.each([
    new AuthenticationRequiredError(),
    new ApiRequestError({ status: 503 }),
  ])("propagates the safe API error $name", async (error) => {
    const request = vi.fn(async () => {
      throw error;
    });
    const apiClient: AuthenticatedApiClient = {
      request: request as AuthenticatedApiClient["request"],
    };

    await expect(getCurrentUser(apiClient)).rejects.toBe(error);
  });

  it("rejects current-user data that violates the shared contract", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn(async () => ({
        user: {
          ...currentUser,
          principal: { kind: "user", userId: currentUser.id },
          accessToken: "must-not-enter-ui-data",
        },
      })),
    } as unknown as Response);
    const apiClient = createAuthenticatedApiClient({
      baseUrl: "http://localhost:4000/api/v1",
      getAccessToken: vi.fn(async () => "verified-access-token"),
      fetch,
    });

    await expect(getCurrentUser(apiClient)).rejects.toBeInstanceOf(
      InvalidApiResponseError,
    );
  });
});
