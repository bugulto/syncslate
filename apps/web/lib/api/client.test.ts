import { z } from "zod";
import { describe, expect, it, vi } from "vitest";

import { createAuthenticatedApiClient } from "./client";
import { AuthenticationRequiredError, InvalidApiResponseError } from "./errors";

const responseSchema = z.object({ value: z.string() }).strict();

function createResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn(async () => body),
  } as unknown as Response;
}

function createClient(options: {
  accessToken?: string | null;
  fetchResponse?: Response;
}) {
  const getAccessToken = vi.fn(async () =>
    options.accessToken === undefined
      ? "verified-access-token"
      : options.accessToken,
  );
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValue(
      options.fetchResponse ?? createResponse({ value: "ok" }),
    );
  const client = createAuthenticatedApiClient({
    baseUrl: "http://localhost:4000/api/v1/",
    getAccessToken,
    fetch,
  });

  return { client, fetch, getAccessToken };
}

describe("createAuthenticatedApiClient", () => {
  it("does not send a request when the access token is missing", async () => {
    const { client, fetch } = createClient({ accessToken: null });

    await expect(client.request("/me", responseSchema)).rejects.toBeInstanceOf(
      AuthenticationRequiredError,
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("attaches the bearer token and preserves caller headers", async () => {
    const { client, fetch } = createClient({});

    await client.request("/me", responseSchema, {
      headers: {
        authorization: "Bearer caller-supplied-token",
        "x-correlation-id": "correlation-id",
      },
    });

    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = fetch.mock.calls[0] ?? [];
    const headers = new Headers(init?.headers);

    expect(url).toBe("http://localhost:4000/api/v1/me");
    expect(headers.get("authorization")).toBe("Bearer verified-access-token");
    expect(headers.get("accept")).toBe("application/json");
    expect(headers.get("x-correlation-id")).toBe("correlation-id");
  });

  it.each(["https://attacker.example/me", "//attacker.example/me"])(
    "rejects the unsafe API path %s",
    async (path) => {
      const { client, fetch, getAccessToken } = createClient({});

      await expect(client.request(path, responseSchema)).rejects.toMatchObject({
        name: "ApiRequestError",
        status: 0,
      });
      expect(getAccessToken).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it("maps unauthorized responses to an authentication error", async () => {
    const { client } = createClient({
      fetchResponse: createResponse(
        { error: { message: "sensitive provider detail" } },
        401,
      ),
    });

    const request = client.request("/me", responseSchema);

    await expect(request).rejects.toBeInstanceOf(AuthenticationRequiredError);
    await expect(request).rejects.not.toThrow("sensitive provider detail");
  });

  it("maps a valid Fastify error envelope to ApiRequestError", async () => {
    const { client } = createClient({
      fetchResponse: createResponse(
        {
          error: {
            code: "FORBIDDEN",
            message: "You cannot access this resource.",
            requestId: "request-123",
          },
        },
        403,
      ),
    });

    await expect(client.request("/me", responseSchema)).rejects.toMatchObject({
      name: "ApiRequestError",
      status: 403,
      code: "FORBIDDEN",
      message: "You cannot access this resource.",
      requestId: "request-123",
    });
  });

  it("does not expose a malformed backend error body", async () => {
    const { client } = createClient({
      fetchResponse: createResponse(
        { databaseError: "sensitive database detail" },
        500,
      ),
    });

    const request = client.request("/me", responseSchema);

    await expect(request).rejects.toMatchObject({
      name: "ApiRequestError",
      status: 500,
      message: "Unable to complete the request.",
    });
    await expect(request).rejects.not.toThrow("sensitive database detail");
  });

  it("returns a response that satisfies the supplied schema", async () => {
    const { client } = createClient({
      fetchResponse: createResponse({ value: "validated" }),
    });

    await expect(client.request("/me", responseSchema)).resolves.toEqual({
      value: "validated",
    });
  });

  it("rejects a successful response that violates its schema", async () => {
    const { client } = createClient({
      fetchResponse: createResponse({ value: 42 }),
    });

    await expect(client.request("/me", responseSchema)).rejects.toBeInstanceOf(
      InvalidApiResponseError,
    );
  });

  it("rejects a successful response containing malformed JSON", async () => {
    const malformedResponse = createResponse(null);
    vi.mocked(malformedResponse.json).mockRejectedValue(new SyntaxError());
    const { client } = createClient({ fetchResponse: malformedResponse });

    await expect(client.request("/me", responseSchema)).rejects.toBeInstanceOf(
      InvalidApiResponseError,
    );
  });

  it("normalizes network failures without exposing their details", async () => {
    const { client, fetch } = createClient({});
    fetch.mockRejectedValue(new Error("sensitive network detail"));

    const request = client.request("/me", responseSchema);

    await expect(request).rejects.toMatchObject({
      name: "ApiRequestError",
      status: 0,
      message: "Unable to complete the request.",
    });
    await expect(request).rejects.not.toThrow("sensitive network detail");
  });
});
