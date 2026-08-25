import type { CreateProfileIfMissingInput, Profile } from "@syncslate/database";
import { describe, expect, it, vi } from "vitest";

import type { AuthenticatedUser } from "./authenticated-user.js";
import {
  createProfileBootstrapService,
  type ProfileBootstrapRepository,
} from "./profile-bootstrap.js";

const userId = "550e8400-e29b-41d4-a716-446655440000";
const createdAt = new Date("2026-08-27T00:00:00.000Z");

const authenticatedUser: AuthenticatedUser = {
  principal: { kind: "user", userId },
  email: "ada@example.com",
  displayName: "Ada Lovelace",
  avatarUrl: "https://example.com/provider-avatar.png",
};

const profile: Profile = {
  id: userId,
  displayName: "Ada Lovelace",
  avatarUrl: "https://example.com/profile-avatar.png",
  createdAt,
  updatedAt: createdAt,
};

function createRepository(overrides: Partial<ProfileBootstrapRepository> = {}) {
  return {
    findProfileByUserId: vi.fn(async () => profile),
    createProfileIfMissing: vi.fn(async () => profile),
    updateProfileMetadata: vi.fn(async () => profile),
    ...overrides,
  } satisfies ProfileBootstrapRepository;
}

describe("createProfileBootstrapService", () => {
  it("creates a missing profile with resolved authentication metadata", async () => {
    const createdProfile = {
      ...profile,
      avatarUrl: authenticatedUser.avatarUrl,
    };
    const repository = createRepository({
      findProfileByUserId: vi.fn(async () => null),
      createProfileIfMissing: vi.fn(async () => createdProfile),
    });
    const bootstrapProfile = createProfileBootstrapService(repository);

    await expect(bootstrapProfile(authenticatedUser)).resolves.toEqual({
      id: userId,
      email: "ada@example.com",
      displayName: "Ada Lovelace",
      avatarUrl: "https://example.com/provider-avatar.png",
    });
    expect(repository.createProfileIfMissing).toHaveBeenCalledWith({
      userId,
      displayName: "Ada Lovelace",
      avatarUrl: "https://example.com/provider-avatar.png",
    });
    expect(repository.updateProfileMetadata).not.toHaveBeenCalled();
  });

  it("returns an existing profile without creating or updating it", async () => {
    const repository = createRepository();
    const bootstrapProfile = createProfileBootstrapService(repository);

    await expect(bootstrapProfile(authenticatedUser)).resolves.toEqual({
      id: userId,
      email: "ada@example.com",
      displayName: "Ada Lovelace",
      avatarUrl: "https://example.com/profile-avatar.png",
    });
    expect(repository.createProfileIfMissing).not.toHaveBeenCalled();
    expect(repository.updateProfileMetadata).not.toHaveBeenCalled();
  });

  it("upgrades the fallback name when explicit metadata becomes available", async () => {
    const fallbackProfile: Profile = {
      ...profile,
      displayName: "Interviewer",
      avatarUrl: null,
    };
    const updatedProfile: Profile = {
      ...fallbackProfile,
      displayName: "Ada Lovelace",
      avatarUrl: authenticatedUser.avatarUrl,
    };
    const repository = createRepository({
      findProfileByUserId: vi.fn(async () => fallbackProfile),
      updateProfileMetadata: vi.fn(async () => updatedProfile),
    });
    const bootstrapProfile = createProfileBootstrapService(repository);

    await expect(bootstrapProfile(authenticatedUser)).resolves.toMatchObject({
      displayName: "Ada Lovelace",
      avatarUrl: "https://example.com/provider-avatar.png",
    });
    expect(repository.updateProfileMetadata).toHaveBeenCalledWith({
      userId,
      displayName: "Ada Lovelace",
      avatarUrl: "https://example.com/provider-avatar.png",
    });
  });

  it("adds a provider avatar when the existing profile has none", async () => {
    const profileWithoutAvatar = { ...profile, avatarUrl: null };
    const updatedProfile = {
      ...profileWithoutAvatar,
      avatarUrl: authenticatedUser.avatarUrl,
    };
    const repository = createRepository({
      findProfileByUserId: vi.fn(async () => profileWithoutAvatar),
      updateProfileMetadata: vi.fn(async () => updatedProfile),
    });
    const bootstrapProfile = createProfileBootstrapService(repository);

    await bootstrapProfile(authenticatedUser);

    expect(repository.updateProfileMetadata).toHaveBeenCalledWith({
      userId,
      avatarUrl: "https://example.com/provider-avatar.png",
    });
  });

  it("preserves customized profile metadata", async () => {
    const repository = createRepository();
    const bootstrapProfile = createProfileBootstrapService(repository);

    await bootstrapProfile({
      ...authenticatedUser,
      displayName: "Provider Name",
      avatarUrl: "https://example.com/new-provider-avatar.png",
    });

    expect(repository.updateProfileMetadata).not.toHaveBeenCalled();
  });

  it("uses the verified email without storing it through the repository", async () => {
    const repository = createRepository();
    const bootstrapProfile = createProfileBootstrapService(repository);

    const currentUser = await bootstrapProfile({
      ...authenticatedUser,
      email: "verified@example.com",
    });

    expect(currentUser.email).toBe("verified@example.com");
    expect(repository.updateProfileMetadata).not.toHaveBeenCalled();
  });

  it("relies on conflict-safe creation for concurrent first requests", async () => {
    let storedProfile: Profile | null = null;
    const createProfileIfMissing = vi.fn(
      async (input: CreateProfileIfMissingInput) => {
        storedProfile ??= {
          id: input.userId,
          displayName: input.displayName,
          avatarUrl: input.avatarUrl,
          createdAt,
          updatedAt: createdAt,
        };

        return storedProfile;
      },
    );
    const repository = createRepository({
      findProfileByUserId: vi.fn(async () => storedProfile),
      createProfileIfMissing,
    });
    const bootstrapProfile = createProfileBootstrapService(repository);

    const [first, second] = await Promise.all([
      bootstrapProfile(authenticatedUser),
      bootstrapProfile(authenticatedUser),
    ]);

    expect(first).toEqual(second);
    expect(createProfileIfMissing).toHaveBeenCalledTimes(2);
  });

  it("rejects a profile that violates the current-user contract", async () => {
    const invalidProfile = { ...profile, displayName: "Al" };
    const repository = createRepository({
      findProfileByUserId: vi.fn(async () => invalidProfile),
    });
    const bootstrapProfile = createProfileBootstrapService(repository);

    await expect(bootstrapProfile(authenticatedUser)).rejects.toThrow();
  });

  it("fails when a profile disappears during a metadata update", async () => {
    const fallbackProfile = {
      ...profile,
      displayName: "Interviewer",
    };
    const repository = createRepository({
      findProfileByUserId: vi.fn(async () => fallbackProfile),
      updateProfileMetadata: vi.fn(async () => null),
    });
    const bootstrapProfile = createProfileBootstrapService(repository);

    await expect(bootstrapProfile(authenticatedUser)).rejects.toThrow(
      "Profile metadata update failed",
    );
  });
});
