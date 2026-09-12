import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

import type { DatabaseClient } from "../client.js";
import {
  admitCandidateByTokenHash,
  createInvitationForOwnedSession,
  findInvitationByTokenHash,
  findInvitationPreviewByTokenHash,
  revokeInvitationForOwnedSession,
} from "./invitation.repository.js";

const interviewerId = "550e8400-e29b-41d4-a716-446655440000";
const sessionId = "30000000-0000-4000-8000-000000000001";
const invitationId = "40000000-0000-4000-8000-000000000001";
const tokenHash = "a".repeat(64);
const expiresAt = new Date("2026-08-18T00:00:00.000Z");
const createdAt = new Date("2026-08-17T00:00:00.000Z");
const now = new Date("2026-08-17T12:00:00.000Z");

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
  previewRows?: Array<{
    sessionId: string;
    expiresAt: Date;
    consumedAt: Date | null;
    revokedAt: Date | null;
    candidateParticipantId: string | null;
    sessionTitle: string;
    sessionStatus: "waiting" | "active";
    language: "typescript";
    durationSeconds: number;
    problemTitle: string | null;
    problemDifficulty: "easy" | null;
  }>;
  updateRows?: InvitationRow[];
};

function createFakeClient({
  ownedSession = true,
  insertRows = [],
  lookupRows,
  previewRows,
  updateRows = [],
}: FakeClientOptions = {}) {
  const selectQuery = {
    from: vi.fn(),
    innerJoin: vi.fn(),
    leftJoin: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(
      async () =>
        lookupRows ?? previewRows ?? (ownedSession ? [{ id: sessionId }] : []),
    ),
  };
  selectQuery.from.mockReturnValue(selectQuery);
  selectQuery.innerJoin.mockReturnValue(selectQuery);
  selectQuery.leftJoin.mockReturnValue(selectQuery);
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

type AdmissionRow = {
  id: string;
  sessionId: string;
  expiresAt: Date;
  consumedAt: Date | null;
  revokedAt: Date | null;
  sessionStatus: "waiting" | "active" | "paused" | "completed" | "cancelled";
};

function createAdmissionClient(options: {
  admissionRows?: AdmissionRow[];
  candidateRows?: { id: string }[];
  participantRows?: Array<{
    id: string;
    displayName: string;
    role: "candidate";
  }>;
  consumedRows?: { id: string }[];
}) {
  const admissionQuery = {
    from: vi.fn(),
    innerJoin: vi.fn(),
    where: vi.fn(),
    for: vi.fn(),
    limit: vi.fn(async () => options.admissionRows ?? []),
  };
  admissionQuery.from.mockReturnValue(admissionQuery);
  admissionQuery.innerJoin.mockReturnValue(admissionQuery);
  admissionQuery.where.mockReturnValue(admissionQuery);
  admissionQuery.for.mockReturnValue(admissionQuery);

  const candidateQuery = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(async () => options.candidateRows ?? []),
  };
  candidateQuery.from.mockReturnValue(candidateQuery);
  candidateQuery.where.mockReturnValue(candidateQuery);

  const participantInsert = {
    values: vi.fn(),
    returning: vi.fn(async () => options.participantRows ?? []),
  };
  participantInsert.values.mockReturnValue(participantInsert);

  const invitationUpdate = {
    set: vi.fn(),
    where: vi.fn(),
    returning: vi.fn(async () => options.consumedRows ?? []),
  };
  invitationUpdate.set.mockReturnValue(invitationUpdate);
  invitationUpdate.where.mockReturnValue(invitationUpdate);

  const transaction = {
    select: vi
      .fn()
      .mockReturnValueOnce(admissionQuery)
      .mockReturnValueOnce(candidateQuery),
    insert: vi.fn(() => participantInsert),
    update: vi.fn(() => invitationUpdate),
  };
  const db = {
    transaction: vi.fn(async (callback: (transaction: unknown) => unknown) =>
      callback(transaction),
    ),
  };

  return {
    client: { db, close: vi.fn() } as unknown as DatabaseClient,
    admissionQuery,
    candidateQuery,
    invitationUpdate,
    participantInsert,
    transaction,
  };
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

  describe("findInvitationPreviewByTokenHash", () => {
    it("returns only candidate-safe session preview fields", async () => {
      const previewRow = {
        sessionId,
        expiresAt,
        consumedAt: null,
        revokedAt: null,
        candidateParticipantId: null,
        sessionTitle: "Backend interview",
        sessionStatus: "waiting" as const,
        language: "typescript" as const,
        durationSeconds: 3_600,
        problemTitle: "Two Sum",
        problemDifficulty: "easy" as const,
      };
      const { client, selectQuery } = createFakeClient({
        previewRows: [previewRow],
      });

      await expect(
        findInvitationPreviewByTokenHash(client, { tokenHash }),
      ).resolves.toEqual({
        sessionId,
        expiresAt,
        consumedAt: null,
        revokedAt: null,
        candidateParticipantId: null,
        session: {
          title: "Backend interview",
          status: "waiting",
          language: "typescript",
          durationSeconds: 3_600,
          problem: { title: "Two Sum", difficulty: "easy" },
        },
      });
      expect(selectQuery.leftJoin).toHaveBeenCalledTimes(2);
      expect(compileSql(selectQuery.where.mock.calls[0]?.[0]).params).toEqual([
        tokenHash,
      ]);
    });

    it("returns a null problem when the session has none", async () => {
      const { client } = createFakeClient({
        previewRows: [
          {
            sessionId,
            expiresAt,
            consumedAt: null,
            revokedAt: null,
            candidateParticipantId: null,
            sessionTitle: "General interview",
            sessionStatus: "active",
            language: "typescript",
            durationSeconds: 1_800,
            problemTitle: null,
            problemDifficulty: null,
          },
        ],
      });

      const result = await findInvitationPreviewByTokenHash(client, {
        tokenHash,
      });
      expect(result?.session.problem).toBeNull();
    });
  });

  describe("admitCandidateByTokenHash", () => {
    const admissionRow: AdmissionRow = {
      id: invitationId,
      sessionId,
      expiresAt: new Date("2026-08-18T00:00:00.000Z"),
      consumedAt: null,
      revokedAt: null,
      sessionStatus: "waiting",
    };
    const participant = {
      id: "50000000-0000-4000-8000-000000000001",
      displayName: "Grace Hopper",
      role: "candidate" as const,
    };

    it("creates the candidate and consumes the invitation atomically", async () => {
      const fake = createAdmissionClient({
        admissionRows: [admissionRow],
        participantRows: [participant],
        consumedRows: [{ id: invitationId }],
      });

      await expect(
        admitCandidateByTokenHash(fake.client, {
          tokenHash,
          displayName: participant.displayName,
          now,
        }),
      ).resolves.toEqual({
        kind: "joined",
        sessionId,
        participant,
      });
      expect(fake.admissionQuery.for).toHaveBeenCalledWith("update");
      expect(fake.participantInsert.values).toHaveBeenCalledWith({
        sessionId,
        displayName: participant.displayName,
        role: "candidate",
        joinedAt: now,
      });
      expect(fake.invitationUpdate.set).toHaveBeenCalledWith({
        consumedAt: now,
      });
      expect(
        compileSql(fake.admissionQuery.where.mock.calls[0]?.[0]).params,
      ).toEqual([tokenHash]);
    });

    it.each([
      ["not_found", []],
      ["expired", [{ ...admissionRow, expiresAt: now }]],
      ["revoked", [{ ...admissionRow, revokedAt: now }]],
      ["consumed", [{ ...admissionRow, consumedAt: now }]],
      [
        "session_closed",
        [{ ...admissionRow, sessionStatus: "paused" as const }],
      ],
      [
        "session_closed",
        [{ ...admissionRow, sessionStatus: "completed" as const }],
      ],
      [
        "session_closed",
        [{ ...admissionRow, sessionStatus: "cancelled" as const }],
      ],
    ] as const)("returns %s without mutating state", async (kind, rows) => {
      const fake = createAdmissionClient({
        admissionRows: [...rows],
      });

      await expect(
        admitCandidateByTokenHash(fake.client, {
          tokenHash,
          displayName: participant.displayName,
          now,
        }),
      ).resolves.toEqual({ kind });
      expect(fake.transaction.insert).not.toHaveBeenCalled();
      expect(fake.transaction.update).not.toHaveBeenCalled();
    });

    it("rejects a second candidate without consuming the invitation", async () => {
      const fake = createAdmissionClient({
        admissionRows: [admissionRow],
        candidateRows: [{ id: participant.id }],
      });

      await expect(
        admitCandidateByTokenHash(fake.client, {
          tokenHash,
          displayName: participant.displayName,
          now,
        }),
      ).resolves.toEqual({ kind: "session_full" });
      expect(fake.transaction.insert).not.toHaveBeenCalled();
      expect(fake.transaction.update).not.toHaveBeenCalled();
    });

    it("fails the transaction when invitation consumption does not complete", async () => {
      const fake = createAdmissionClient({
        admissionRows: [admissionRow],
        participantRows: [participant],
        consumedRows: [],
      });

      await expect(
        admitCandidateByTokenHash(fake.client, {
          tokenHash,
          displayName: participant.displayName,
          now,
        }),
      ).rejects.toThrow(
        "Invitation could not be consumed after candidate insert",
      );
    });
  });
});
