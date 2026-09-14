import type { RoomCredential } from "@syncslate/contracts";

import type { AccessTokenVerifier } from "../auth/access-token-verifier.js";
import type { AuthPrincipal } from "../auth/auth-principal.js";
import type { GuestTokenVerifier } from "../auth/guest-token.js";

export type RoomAuthenticationInput = {
  sessionId: string;
  credential: RoomCredential;
};

export type RoomAuthenticationResult =
  | { kind: "authenticated"; principal: AuthPrincipal }
  | { kind: "invalid" }
  | { kind: "timeout" };

export type RoomAuthenticator = (
  input: RoomAuthenticationInput,
) => Promise<RoomAuthenticationResult>;

export type RoomAuthenticatorOptions = {
  verifyAccessToken: AccessTokenVerifier;
  verifyGuestToken: GuestTokenVerifier;
  timeoutMs: number;
};

async function verifyRoomCredential(
  options: RoomAuthenticatorOptions,
  input: RoomAuthenticationInput,
): Promise<RoomAuthenticationResult> {
  try {
    if (input.credential.kind === "guest") {
      const principal = await options.verifyGuestToken(input.credential.token, {
        sessionId: input.sessionId,
      });

      return principal === null
        ? { kind: "invalid" }
        : { kind: "authenticated", principal };
    }

    const user = await options.verifyAccessToken(input.credential.accessToken);

    return user === null
      ? { kind: "invalid" }
      : { kind: "authenticated", principal: user.principal };
  } catch {
    return { kind: "invalid" };
  }
}

export function createRoomAuthenticator(
  options: RoomAuthenticatorOptions,
): RoomAuthenticator {
  return async (input) => {
    let timeout: ReturnType<typeof setTimeout> | undefined;

    try {
      return await Promise.race([
        verifyRoomCredential(options, input),
        new Promise<RoomAuthenticationResult>((resolve) => {
          timeout = setTimeout(
            () => resolve({ kind: "timeout" }),
            options.timeoutMs,
          );
        }),
      ]);
    } finally {
      if (timeout !== undefined) {
        clearTimeout(timeout);
      }
    }
  };
}

export function isAllowedRoomOrigin(
  origin: string | undefined,
  allowedOrigins: string[],
): boolean {
  if (origin === undefined) {
    return false;
  }

  try {
    const requestOrigin = new URL(origin).origin;

    return allowedOrigins.some(
      (allowedOrigin) => new URL(allowedOrigin).origin === requestOrigin,
    );
  } catch {
    return false;
  }
}
