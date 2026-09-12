import { SignJWT, jwtVerify } from "jose";
import { guestAccessTokenSchema } from "@syncslate/contracts";
import { z } from "zod";

import type { GuestAuthPrincipal } from "./auth-principal.js";

const GUEST_TOKEN_ALGORITHM = "HS256";
const GUEST_TOKEN_ISSUER = "syncslate-api";
const GUEST_TOKEN_AUDIENCE = "syncslate-room";

const guestTokenClaimsSchema = z
  .object({
    sub: z.uuid(),
    participantId: z.uuid(),
    sessionId: z.uuid(),
    role: z.literal("candidate"),
    iss: z.literal(GUEST_TOKEN_ISSUER),
    aud: z.literal(GUEST_TOKEN_AUDIENCE),
    iat: z.number().int(),
    exp: z.number().int(),
  })
  .passthrough();

export type GuestTokenBinding = {
  sessionId?: string;
  participantId?: string;
};

export type GuestTokenIssuer = (input: {
  participantId: string;
  sessionId: string;
}) => Promise<{ token: string; expiresAt: Date }>;

export type GuestTokenVerifier = (
  token: string,
  binding?: GuestTokenBinding,
) => Promise<GuestAuthPrincipal | null>;

export type GuestTokenService = {
  issue: GuestTokenIssuer;
  verify: GuestTokenVerifier;
};

export function createGuestTokenService(options: {
  secret: string;
  ttlSeconds: number;
  now?: () => Date;
}): GuestTokenService {
  const key = new TextEncoder().encode(options.secret);
  const now = options.now ?? (() => new Date());

  return {
    async issue(input) {
      const issuedAt = Math.floor(now().getTime() / 1_000);
      const expiresAtSeconds = issuedAt + options.ttlSeconds;
      const token = await new SignJWT({
        participantId: input.participantId,
        sessionId: input.sessionId,
        role: "candidate",
      })
        .setProtectedHeader({ alg: GUEST_TOKEN_ALGORITHM, typ: "JWT" })
        .setIssuer(GUEST_TOKEN_ISSUER)
        .setAudience(GUEST_TOKEN_AUDIENCE)
        .setSubject(input.participantId)
        .setIssuedAt(issuedAt)
        .setExpirationTime(expiresAtSeconds)
        .sign(key);

      return {
        token,
        expiresAt: new Date(expiresAtSeconds * 1_000),
      };
    },

    async verify(token, binding = {}) {
      if (!guestAccessTokenSchema.safeParse(token).success) {
        return null;
      }

      try {
        const result = await jwtVerify(token, key, {
          algorithms: [GUEST_TOKEN_ALGORITHM],
          issuer: GUEST_TOKEN_ISSUER,
          audience: GUEST_TOKEN_AUDIENCE,
          currentDate: now(),
        });
        const claims = guestTokenClaimsSchema.parse(result.payload);

        if (claims.sub !== claims.participantId) {
          return null;
        }

        if (
          binding.sessionId !== undefined &&
          binding.sessionId !== claims.sessionId
        ) {
          return null;
        }

        if (
          binding.participantId !== undefined &&
          binding.participantId !== claims.participantId
        ) {
          return null;
        }

        return {
          kind: "guest",
          participantId: claims.participantId,
          sessionId: claims.sessionId,
          role: "candidate",
        };
      } catch {
        return null;
      }
    },
  };
}
