import { eq } from "drizzle-orm";

import type { DatabaseClient } from "../client.js";
import { profiles, type Profile } from "../schema.js";

export type CreateProfileIfMissingInput = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
};

export type UpdateProfileMetadataInput = {
  userId: string;
  displayName?: string;
  avatarUrl?: string | null;
};

export async function findProfileByUserId(
  client: DatabaseClient,
  userId: string,
): Promise<Profile | null> {
  const [profile] = await client.db
    .select()
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  return profile ?? null;
}

export async function createProfileIfMissing(
  client: DatabaseClient,
  input: CreateProfileIfMissingInput,
): Promise<Profile> {
  const [createdProfile] = await client.db
    .insert(profiles)
    .values({
      id: input.userId,
      displayName: input.displayName,
      avatarUrl: input.avatarUrl,
    })
    .onConflictDoNothing({ target: profiles.id })
    .returning();

  if (createdProfile) {
    return createdProfile;
  }

  const existingProfile = await findProfileByUserId(client, input.userId);

  if (!existingProfile) {
    throw new Error(
      `Profile could not be created or found for user ${input.userId}`,
    );
  }

  return existingProfile;
}

export async function updateProfileMetadata(
  client: DatabaseClient,
  input: UpdateProfileMetadataInput,
): Promise<Profile | null> {
  const existingProfile = await findProfileByUserId(client, input.userId);

  if (!existingProfile) {
    return null;
  }

  const updates: {
    displayName?: string;
    avatarUrl?: string | null;
    updatedAt: Date;
  } = {
    updatedAt: new Date(),
  };
  let hasMetadataChanges = false;

  if (
    input.displayName !== undefined &&
    input.displayName !== existingProfile.displayName
  ) {
    updates.displayName = input.displayName;
    hasMetadataChanges = true;
  }

  if (
    input.avatarUrl !== undefined &&
    input.avatarUrl !== existingProfile.avatarUrl
  ) {
    updates.avatarUrl = input.avatarUrl;
    hasMetadataChanges = true;
  }

  if (!hasMetadataChanges) {
    return existingProfile;
  }

  const [updatedProfile] = await client.db
    .update(profiles)
    .set(updates)
    .where(eq(profiles.id, input.userId))
    .returning();

  return updatedProfile ?? null;
}
