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

export type AuthenticatedApiClient = {
  request: <T>(
    path: string,
    responseSchema: ZodType<T>,
    init?: RequestInit,
  ) => Promise<T>;
};

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

    return url.toString().replace(/\/$/u, "");
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

export function createAuthenticatedApiClient(
  options: AuthenticatedApiClientOptions,
): AuthenticatedApiClient {
  const baseUrl = normalizeBaseUrl(options.baseUrl);

  return {
    async request(path, responseSchema, init = {}) {
      const url = buildRequestUrl(baseUrl, path);
      const accessToken = await options.getAccessToken();

      if (!accessToken) {
        throw new AuthenticationRequiredError();
      }

      const headers = new Headers(init.headers);
      headers.set("accept", "application/json");
      headers.set("authorization", `Bearer ${accessToken}`);

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

      if (response.status === 401) {
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
