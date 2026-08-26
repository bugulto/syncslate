import type { ApiError, ApiErrorCode } from "@syncslate/contracts";

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Authentication required.");
    this.name = "AuthenticationRequiredError";
  }
}

export type ApiRequestErrorOptions = {
  status: number;
  error?: ApiError["error"];
};

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode | null;
  readonly requestId: string | null;

  constructor(options: ApiRequestErrorOptions) {
    super(options.error?.message ?? "Unable to complete the request.");
    this.name = "ApiRequestError";
    this.status = options.status;
    this.code = options.error?.code ?? null;
    this.requestId = options.error?.requestId ?? null;
  }
}

export class InvalidApiResponseError extends Error {
  constructor() {
    super("The server returned an invalid response.");
    this.name = "InvalidApiResponseError";
  }
}
