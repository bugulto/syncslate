import { apiErrorSchema } from "@syncslate/contracts";
import type { ZodType } from "zod";

import {
  ApiRequestError,
  AuthenticationRequiredError,
  InvalidApiResponseError,
} from "./errors";

export type AuthenticatedApiClientOptions = {
  baseUrl: string;
  getAccessToken: () => Promise<string | null>;
  fetch: typeof globalThis.fetch;
};

export type PublicApiClientOptions = {
  baseUrl: string;
  fetch: typeof globalThis.fetch;
};

export type ApiClient = {
  request: <T>(
    path: string,
    responseSchema: ZodType<T>,
    init?: RequestInit,
  ) => Promise<T>;
};

export type AuthenticatedApiClient = ApiClient;
export type PublicApiClient = ApiClient;

function normalizeBaseUrl(baseUrl: string): string {
  try {
    const url = new URL(baseUrl);

    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.search ||
      url.hash
    ) {
      throw new Error();
    }

    return url.toString().replace(/\/+$/u, "");
  } catch {
    throw new Error("Invalid API base URL.");
  }
}

function buildRequestUrl(baseUrl: string, path: string): string {
  if (!/^\/(?!\/)[^\\]*$/u.test(path)) {
    throw new ApiRequestError({ status: 0 });
  }

  return `${baseUrl}${path}`;
}

function createApiClient(
  options: PublicApiClientOptions,
  getAccessToken?: () => Promise<string | null>,
): ApiClient {
  const baseUrl = normalizeBaseUrl(options.baseUrl);

  return {
    async request(path, responseSchema, init = {}) {
      const url = buildRequestUrl(baseUrl, path);
      const headers = new Headers(init.headers);
      headers.set("accept", "application/json");

      if (getAccessToken === undefined) {
        headers.delete("authorization");
      } else {
        const accessToken = await getAccessToken();

        if (!accessToken) {
          throw new AuthenticationRequiredError();
        }

        headers.set("authorization", `Bearer ${accessToken}`);
      }

      if (init.body !== undefined && !headers.has("content-type")) {
        headers.set("content-type", "application/json");
      }

      let response: Response;

      try {
        response = await options.fetch(url, {
          ...init,
          headers,
        });
      } catch {
        throw new ApiRequestError({ status: 0 });
      }

      if (response.status === 401 && getAccessToken !== undefined) {
        throw new AuthenticationRequiredError();
      }

      let body: unknown;

      try {
        body = await response.json();
      } catch {
        if (!response.ok) {
          throw new ApiRequestError({ status: response.status });
        }

        throw new InvalidApiResponseError();
      }

      if (!response.ok) {
        const parsedError = apiErrorSchema.safeParse(body);

        throw new ApiRequestError({
          status: response.status,
          ...(parsedError.success ? { error: parsedError.data.error } : {}),
        });
      }

      const parsedResponse = responseSchema.safeParse(body);

      if (!parsedResponse.success) {
        throw new InvalidApiResponseError();
      }

      return parsedResponse.data;
    },
  };
}

export function createAuthenticatedApiClient(
  options: AuthenticatedApiClientOptions,
): AuthenticatedApiClient {
  return createApiClient(options, options.getAccessToken);
}

export function createPublicApiClient(
  options: PublicApiClientOptions,
): PublicApiClient {
  return createApiClient(options);
}
