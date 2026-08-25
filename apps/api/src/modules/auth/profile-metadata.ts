import { displayNameSchema } from "@syncslate/contracts";

import type { AuthenticatedUser } from "./authenticated-user.js";

export type ProfileMetadata = {
  displayName: string;
  avatarUrl: string | null;
};

export const fallbackProfileDisplayName = "Interviewer";

function deriveDisplayNameFromEmail(email: string | null): string | null {
  if (!email) {
    return null;
  }

  const localPart = email.split("@", 1)[0];
  const withoutTag = localPart?.split("+", 1)[0];

  if (!withoutTag) {
    return null;
  }

  const normalized = withoutTag
    .replace(/[._-]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  const truncated = Array.from(normalized).slice(0, 20).join("").trim();
  const result = displayNameSchema.safeParse(truncated);

  return result.success ? result.data : null;
}

export function resolveProfileMetadata(
  authenticatedUser: AuthenticatedUser,
): ProfileMetadata {
  const verifiedDisplayName = displayNameSchema.safeParse(
    authenticatedUser.displayName,
  );

  return {
    displayName: verifiedDisplayName.success
      ? verifiedDisplayName.data
      : (deriveDisplayNameFromEmail(authenticatedUser.email) ??
        fallbackProfileDisplayName),
    avatarUrl: authenticatedUser.avatarUrl,
  };
}
