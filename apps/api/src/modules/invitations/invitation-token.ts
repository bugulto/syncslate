import { createHmac, randomBytes } from "node:crypto";

const INVITATION_TOKEN_BYTES = 32;

export function generateInvitationToken(): string {
  return randomBytes(INVITATION_TOKEN_BYTES).toString("base64url");
}

export function hashInvitationToken(
  rawToken: string,
  tokenPepper: string,
): string {
  return createHmac("sha256", tokenPepper).update(rawToken).digest("hex");
}
