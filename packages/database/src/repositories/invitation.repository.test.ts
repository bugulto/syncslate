import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

import type { DatabaseClient } from "../client.js";
import {
  createInvitationForOwnedSession,
  findInvitationByTokenHash,
  revokeInvitationForOwnedSession,
} from "./invitation.repository.js";

const interviewerId = "550e8400-e29b-41d4-a716-446655440000";
const sessionId = "30000000-0000-4000-8000-000000000001";
const invitationId = "40000000-0000-4000-8000-000000000001";
const tokenHash = "a".repeat(64);
const expiresAt = new Date("2026-08-18T00:00:00.000Z");
const createdAt = new Date("2026-08-17T00:00:00.000Z");

type InvitationRow = {
  id: string;
  sessionId: string;
  expiresAt: Date;
  consumedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
};

const invitationRow: InvitationRow = {
  id: invitationId,
  sessionId,
  expiresAt,
  consumedAt: null,
  revokedAt: null,
  createdAt,
};

type FakeClientOptions = {
  ownedSession?: boolean;
  insertRows?: InvitationRow[];
  lookupRows?: Array<InvitationRow & { sessionStatus: "waiting" | "active" }>;
  updateRows?: InvitationRow[];
};

function createFakeClient({
  ownedSession = true,
  insertRows = [],
  lookupRows,
  updateRows = [],
}: FakeClientOptions = {}) {
  const selectQuery = {
    from: vi.fn(),
    innerJoin: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(
      async () => lookupRows ?? (ownedSession ? [{ id: sessionId }] : []),
    ),
  };
  selectQuery.from.mockReturnValue(selectQuery);
  selectQuery.innerJoin.mockReturnValue(selectQuery);
  selectQuery.where.mockReturnValue(selectQuery);

  const insertQuery = {
    values: vi.fn(),
    returning: vi.fn(async () => insertRows),
  };
  insertQuery.values.mockReturnValue(insertQuery);

  const updateQuery = {
    set: vi.fn(),
    where: vi.fn(),
    returning: vi.fn(async () => updateRows),
  };
  updateQuery.set.mockReturnValue(updateQuery);
  updateQuery.where.mockReturnValue(updateQuery);

  const db = {
    select: vi.fn(() => selectQuery),
    insert: vi.fn(() => insertQuery),
    update: vi.fn(() => updateQuery),
  };

  return {
    client: { db, close: vi.fn() } as unknown as DatabaseClient,
    db,
    insertQuery,
    selectQuery,
    updateQuery,
  };
}

function compileSql(expression: unknown) {
  return new PgDialect().sqlToQuery(expression as SQL);
}

describe("invitation repository", () => {
  describe("createInvitationForOwnedSession", () => {
    it("stores only the hash and returns metadata without it", async () => {
      const { client, insertQuery } = createFakeClient({
        insertRows: [invitationRow],
      });

      const result = await createInvitationForOwnedSession(client, {
        interviewerId,
        sessionId,
        tokenHash,
        expiresAt,
      });

      expect(insertQuery.values).toHaveBeenCalledWith({
        sessionId,
        tokenHash,
        expiresAt,
      });
      expect(result).toEqual({
        id: invitationId,
        sessionId,
        expiresAt: expiresAt.toISOString(),
        consumedAt: null,
        revokedAt: null,
        createdAt: createdAt.toISOString(),
      });
      expect(result).not.toHaveProperty("tokenHash");
      expect(result).not.toHaveProperty("rawToken");
    });

    it("does not insert for a session owned by another interviewer", async () => {
      const { client, db } = createFakeClient({ ownedSession: false });

      await expect(
        createInvitationForOwnedSession(client, {
          interviewerId,
          sessionId,
          tokenHash,
          expiresAt,
        }),
      ).resolves.toBeNull();
      expect(db.insert).not.toHaveBeenCalled();
    });
  });

  describe("revokeInvitationForOwnedSession", () => {
    it("sets the revocation timestamp and returns safe metadata", async () => {
      const revokedAt = new Date("2026-08-17T01:00:00.000Z");
      const { client, updateQuery } = createFakeClient({
        updateRows: [{ ...invitationRow, revokedAt }],
      });

      const result = await revokeInvitationForOwnedSession(client, {
        interviewerId,
        sessionId,
        revokedAt,
      });

      expect(updateQuery.set).toHaveBeenCalledWith({ revokedAt });
      expect(result?.revokedAt).toBe(revokedAt.toISOString());
      expect(result).not.toHaveProperty("tokenHash");
    });

    it("does not update invitations for another interviewer's session", async () => {
      const { client, db } = createFakeClient({ ownedSession: false });

      await expect(
        revokeInvitationForOwnedSession(client, {
          interviewerId,
          sessionId,
          revokedAt: new Date(),
        }),
      ).resolves.toBeNull();
      expect(db.update).not.toHaveBeenCalled();
    });
  });

  describe("findInvitationByTokenHash", () => {
    it("returns invitation lifecycle and session status without the hash", async () => {
      const lookupRow = {
        ...invitationRow,
        sessionStatus: "waiting" as const,
      };
      const { client, selectQuery } = createFakeClient({
        lookupRows: [lookupRow],
      });

      const result = await findInvitationByTokenHash(client, { tokenHash });

      expect(result).toEqual(lookupRow);
      expect(result).not.toHaveProperty("tokenHash");
      expect(result).not.toHaveProperty("rawToken");
      expect(compileSql(selectQuery.where.mock.calls[0]?.[0]).params).toEqual([
        tokenHash,
      ]);
    });

    it("returns null for an unknown hash", async () => {
      const { client } = createFakeClient({ lookupRows: [] });

      await expect(
        findInvitationByTokenHash(client, { tokenHash }),
      ).resolves.toBeNull();
    });
  });
});
