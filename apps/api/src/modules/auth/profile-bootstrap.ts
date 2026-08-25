import { currentUserSchema, type CurrentUser } from "@syncslate/contracts";
import type {
  CreateProfileIfMissingInput,
  Profile,
  UpdateProfileMetadataInput,
} from "@syncslate/database";

import type { AuthenticatedUser } from "./authenticated-user.js";
import {
  fallbackProfileDisplayName,
  resolveProfileMetadata,
} from "./profile-metadata.js";

export type ProfileBootstrapRepository = {
  findProfileByUserId: (userId: string) => Promise<Profile | null>;
  createProfileIfMissing: (
    input: CreateProfileIfMissingInput,
  ) => Promise<Profile>;
  updateProfileMetadata: (
    input: UpdateProfileMetadataInput,
  ) => Promise<Profile | null>;
};

export type ProfileBootstrapService = (
  authenticatedUser: AuthenticatedUser,
) => Promise<CurrentUser>;

export function createProfileBootstrapService(
  repository: ProfileBootstrapRepository,
): ProfileBootstrapService {
  return async (authenticatedUser) => {
    const userId = authenticatedUser.principal.userId;
    const metadata = resolveProfileMetadata(authenticatedUser);
    const existingProfile = await repository.findProfileByUserId(userId);
    let profile =
      existingProfile ??
      (await repository.createProfileIfMissing({
        userId,
        displayName: metadata.displayName,
        avatarUrl: metadata.avatarUrl,
      }));

    if (existingProfile) {
      const updates: UpdateProfileMetadataInput = { userId };

      if (
        profile.displayName === fallbackProfileDisplayName &&
        authenticatedUser.displayName !== null &&
        metadata.displayName !== profile.displayName
      ) {
        updates.displayName = metadata.displayName;
      }

      if (profile.avatarUrl === null && metadata.avatarUrl !== null) {
        updates.avatarUrl = metadata.avatarUrl;
      }

      if (
        updates.displayName !== undefined ||
        updates.avatarUrl !== undefined
      ) {
        const updatedProfile = await repository.updateProfileMetadata(updates);

        if (!updatedProfile) {
          throw new Error("Profile metadata update failed");
        }

        profile = updatedProfile;
      }
    }

    return currentUserSchema.parse({
      id: profile.id,
      email: authenticatedUser.email,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
    });
  };
}
