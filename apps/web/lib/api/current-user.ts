import { meResponseSchema, type CurrentUser } from "@syncslate/contracts";

import type { AuthenticatedApiClient } from "./client";

export async function getCurrentUser(
  apiClient: AuthenticatedApiClient,
): Promise<CurrentUser> {
  const response = await apiClient.request("/me", meResponseSchema, {
    method: "GET",
    cache: "no-store",
  });

  return response.user;
}
