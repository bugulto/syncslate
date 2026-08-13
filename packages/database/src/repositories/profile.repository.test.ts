import { describe, expect, it, vi } from "vitest";

import type { DatabaseClient } from "../client.js";
import type { Profile } from "../schema.js";
import {
  createProfileIfMissing,
  findProfileByUserId,
  updateProfileMetadata,
} from "./profile.repository.js";

const userId = "550e8400-e29b-41d4-a716-446655440000";
const createdAt = new Date("2026-08-17T00:00:00.000Z");
const updatedAt = new Date("2026-08-17T00:00:00.000Z");

const profile: Profile = {
  id: userId,
  displayName: "Ada Lovelace",
  avatarUrl: null,
  createdAt,
  updatedAt,
};

type FakeClientOptions = {
  selectRows?: Profile[];
  insertRows?: Profile[];
  updateRows?: Profile[];
};

function createFakeClient({
  selectRows = [],
  insertRows = [],
  updateRows = [],
}: FakeClientOptions = {}) {
  const from = vi.fn();
  const whereSelect = vi.fn();
  const limit = vi.fn(async () => selectRows);
  const selectQuery = { from, where: whereSelect, limit };
  from.mockReturnValue(selectQuery);
  whereSelect.mockReturnValue(selectQuery);

  const values = vi.fn();
  const onConflictDoNothing = vi.fn();
  const returningInsert = vi.fn(async () => insertRows);
  const insertQuery = {
    values,
    onConflictDoNothing,
    returning: returningInsert,
  };
  values.mockReturnValue(insertQuery);
  onConflictDoNothing.mockReturnValue(insertQuery);

  const set = vi.fn();
  const whereUpdate = vi.fn();
  const returningUpdate = vi.fn(async () => updateRows);
  const updateQuery = { set, where: whereUpdate, returning: returningUpdate };
  set.mockReturnValue(updateQuery);
  whereUpdate.mockReturnValue(updateQuery);

  const db = {
    select: vi.fn(() => selectQuery),
    insert: vi.fn(() => insertQuery),
    update: vi.fn(() => updateQuery),
  };

  return {
    client: { db, close: vi.fn() } as unknown as DatabaseClient,
    db,
    values,
    set,
  };
}

describe("profile repository", () => {
  describe("findProfileByUserId", () => {
    it("returns the matching profile", async () => {
      const { client } = createFakeClient({ selectRows: [profile] });

      await expect(findProfileByUserId(client, userId)).resolves.toEqual(
        profile,
      );
    });

    it("returns null when the profile does not exist", async () => {
      const { client } = createFakeClient();

      await expect(findProfileByUserId(client, userId)).resolves.toBeNull();
    });
  });

  describe("createProfileIfMissing", () => {
    it("creates and returns a missing profile", async () => {
      const { client, values } = createFakeClient({ insertRows: [profile] });

      await expect(
        createProfileIfMissing(client, {
          userId,
          displayName: "Ada Lovelace",
          avatarUrl: null,
        }),
      ).resolves.toEqual(profile);
      expect(values).toHaveBeenCalledWith({
        id: userId,
        displayName: "Ada Lovelace",
        avatarUrl: null,
      });
      expect(client.db.select).not.toHaveBeenCalled();
    });

    it("returns the existing profile after an insert conflict", async () => {
      const { client } = createFakeClient({ selectRows: [profile] });

      await expect(
        createProfileIfMissing(client, {
          userId,
          displayName: "Ada Lovelace",
          avatarUrl: null,
        }),
      ).resolves.toEqual(profile);
      expect(client.db.select).toHaveBeenCalledOnce();
    });
  });

  describe("updateProfileMetadata", () => {
    it("does not write when the metadata is unchanged", async () => {
      const { client } = createFakeClient({ selectRows: [profile] });

      await expect(
        updateProfileMetadata(client, {
          userId,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
        }),
      ).resolves.toEqual(profile);
      expect(client.db.update).not.toHaveBeenCalled();
    });

    it("updates changed metadata and the update timestamp", async () => {
      const updatedProfile: Profile = {
        ...profile,
        displayName: "Countess of Lovelace",
        avatarUrl: "https://example.com/ada.png",
        updatedAt: new Date("2026-08-17T01:00:00.000Z"),
      };
      const { client, set } = createFakeClient({
        selectRows: [profile],
        updateRows: [updatedProfile],
      });

      await expect(
        updateProfileMetadata(client, {
          userId,
          displayName: updatedProfile.displayName,
          avatarUrl: updatedProfile.avatarUrl,
        }),
      ).resolves.toEqual(updatedProfile);
      expect(set).toHaveBeenCalledWith({
        displayName: updatedProfile.displayName,
        avatarUrl: updatedProfile.avatarUrl,
        updatedAt: expect.any(Date),
      });
    });
  });
});
