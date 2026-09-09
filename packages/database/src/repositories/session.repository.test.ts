import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

import type { DatabaseClient } from "../client.js";
import {
  createSession,
  findSessionByIdForInterviewer,
  listSessionsByInterviewer,
} from "./session.repository.js";

const interviewerId = "550e8400-e29b-41d4-a716-446655440000";
const otherInterviewerId = "550e8400-e29b-41d4-a716-446655440001";
const sessionId = "30000000-0000-4000-8000-000000000001";
const problemId = "10000000-0000-4000-8000-000000000001";
const createdAt = new Date("2026-08-17T00:00:00.000Z");
const updatedAt = new Date("2026-08-18T00:00:00.000Z");

const sessionRow = {
  id: sessionId,
  title: "Frontend interview",
  status: "waiting" as const,
  language: "typescript" as const,
  editingPolicy: "candidate_only" as const,
  durationSeconds: 3600,
  startedAt: null,
  endedAt: null,
  createdAt,
  updatedAt,
};

const problemRow = {
  id: problemId,
  title: "Two Sum",
  slug: "two-sum",
  difficulty: "easy" as const,
  tags: ["arrays", "hash map"],
  visibility: "seeded" as const,
  descriptionMarkdown: "Find two values.",
  constraintsMarkdown: null,
  examples: [],
  interviewerNotesMarkdown: null,
  createdAt,
  updatedAt,
};

type FakeClientOptions = {
  insertRows?: { id: string }[];
  participantInsertError?: Error;
  selectRows?: unknown[];
};

function createFakeClient({
  insertRows = [],
  participantInsertError,
  selectRows = [],
}: FakeClientOptions = {}) {
  const selectQuery = {
    from: vi.fn(),
    leftJoin: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(async () => selectRows),
  };
  selectQuery.from.mockReturnValue(selectQuery);
  selectQuery.leftJoin.mockReturnValue(selectQuery);
  selectQuery.where.mockReturnValue(selectQuery);

  const sessionInsertQuery = {
    values: vi.fn(),
    returning: vi.fn(async () => insertRows),
  };
  sessionInsertQuery.values.mockReturnValue(sessionInsertQuery);

  const participantInsertQuery = {
    values: vi.fn(async () => {
      if (participantInsertError) {
        throw participantInsertError;
      }
    }),
  };

  const transaction = {
    insert: vi
      .fn()
      .mockReturnValueOnce(sessionInsertQuery)
      .mockReturnValueOnce(participantInsertQuery),
  };

  const db = {
    transaction: vi.fn(async (callback: (transaction: unknown) => unknown) =>
      callback(transaction),
    ),
    select: vi.fn(() => selectQuery),
  };

  return {
    client: { db, close: vi.fn() } as unknown as DatabaseClient,
    db,
    participantInsertQuery,
    sessionInsertQuery,
    selectQuery,
    transaction,
  };
}

function compileSql(expression: unknown) {
  return new PgDialect().sqlToQuery(expression as SQL);
}

describe("session repository", () => {
  describe("createSession", () => {
    it("persists the supplied values and returns the created detail", async () => {
      const detailRows = [
        {
          session: sessionRow,
          problem: problemRow,
          starterCode: {
            language: "typescript" as const,
            code: "export function twoSum() {}",
          },
        },
      ];
      const { client, participantInsertQuery, sessionInsertQuery } =
        createFakeClient({
          insertRows: [{ id: sessionId }],
          selectRows: detailRows,
        });
      const timerState = { status: "idle", durationMs: 3_600_000 };

      const result = await createSession(client, {
        interviewerId,
        interviewerDisplayName: "Ada Lovelace",
        problemId,
        title: sessionRow.title,
        language: sessionRow.language,
        durationSeconds: sessionRow.durationSeconds,
        status: sessionRow.status,
        editingPolicy: sessionRow.editingPolicy,
        timerState,
      });

      expect(sessionInsertQuery.values).toHaveBeenCalledWith({
        interviewerId,
        problemId,
        title: sessionRow.title,
        language: sessionRow.language,
        durationSeconds: sessionRow.durationSeconds,
        status: sessionRow.status,
        editingPolicy: sessionRow.editingPolicy,
        timerState,
      });
      expect(participantInsertQuery.values).toHaveBeenCalledWith({
        sessionId,
        userId: interviewerId,
        displayName: "Ada Lovelace",
        role: "interviewer",
      });
      expect(result.id).toBe(sessionId);
      expect(result.problem?.starterCode).toEqual([detailRows[0]?.starterCode]);
    });

    it("fails clearly when the insert returns no session", async () => {
      const { client } = createFakeClient();

      await expect(
        createSession(client, {
          interviewerId,
          interviewerDisplayName: "Ada Lovelace",
          problemId,
          title: sessionRow.title,
          language: sessionRow.language,
          durationSeconds: sessionRow.durationSeconds,
          status: sessionRow.status,
          editingPolicy: sessionRow.editingPolicy,
          timerState: {},
        }),
      ).rejects.toThrow("Session insert did not return the created session");
    });

    it("propagates participant insertion failures from the transaction", async () => {
      const { client } = createFakeClient({
        insertRows: [{ id: sessionId }],
        participantInsertError: new Error("participant insert failed"),
      });

      await expect(
        createSession(client, {
          interviewerId,
          interviewerDisplayName: "Ada Lovelace",
          problemId,
          title: sessionRow.title,
          language: sessionRow.language,
          durationSeconds: sessionRow.durationSeconds,
          status: sessionRow.status,
          editingPolicy: sessionRow.editingPolicy,
          timerState: {},
        }),
      ).rejects.toThrow("participant insert failed");
    });
  });

  describe("listSessionsByInterviewer", () => {
    it("maps sessions newest-first and collects available languages", async () => {
      const olderSession = {
        ...sessionRow,
        id: "30000000-0000-4000-8000-000000000002",
        title: "Older interview",
        createdAt: new Date("2026-08-16T00:00:00.000Z"),
      };
      const listProblem = {
        id: problemRow.id,
        title: problemRow.title,
        slug: problemRow.slug,
        difficulty: problemRow.difficulty,
        tags: problemRow.tags,
        visibility: problemRow.visibility,
      };
      const { client, selectQuery } = createFakeClient({
        selectRows: [
          {
            session: sessionRow,
            problem: listProblem,
            starterLanguage: "typescript",
          },
          {
            session: sessionRow,
            problem: listProblem,
            starterLanguage: "python",
          },
          {
            session: olderSession,
            problem: null,
            starterLanguage: null,
          },
        ],
      });

      const result = await listSessionsByInterviewer(client, {
        interviewerId,
      });

      expect(result.map((session) => session.id)).toEqual([
        sessionId,
        olderSession.id,
      ]);
      expect(result[0]?.problem?.availableLanguages).toEqual([
        "typescript",
        "python",
      ]);
      expect(result[1]?.problem).toBeNull();

      const where = compileSql(selectQuery.where.mock.calls[0]?.[0]);
      expect(where.params).toEqual([interviewerId]);
      const orderBy = selectQuery.orderBy.mock.calls[0]?.map(
        (expression) => compileSql(expression).sql,
      );
      expect(orderBy).toEqual([
        '"interview_sessions"."created_at" desc',
        '"interview_sessions"."id" desc',
        '"problem_starter_code"."language" asc',
      ]);
    });
  });

  describe("findSessionByIdForInterviewer", () => {
    it("returns null for a missing or inaccessible session", async () => {
      const { client } = createFakeClient();

      await expect(
        findSessionByIdForInterviewer(client, {
          interviewerId: otherInterviewerId,
          sessionId,
        }),
      ).resolves.toBeNull();
    });

    it("maps session, problem, starter code, and timestamps", async () => {
      const startedAt = new Date("2026-08-17T00:10:00.000Z");
      const rows = [
        {
          session: { ...sessionRow, startedAt },
          problem: problemRow,
          starterCode: {
            language: "typescript" as const,
            code: "typescript code",
          },
        },
        {
          session: { ...sessionRow, startedAt },
          problem: problemRow,
          starterCode: {
            language: "python" as const,
            code: "python code",
          },
        },
      ];
      const { client } = createFakeClient({ selectRows: rows });

      const result = await findSessionByIdForInterviewer(client, {
        interviewerId,
        sessionId,
      });

      expect(result).toMatchObject({
        id: sessionId,
        startedAt: startedAt.toISOString(),
        endedAt: null,
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
      });
      expect(result?.problem).toMatchObject({
        id: problemId,
        availableLanguages: ["typescript", "python"],
        starterCode: rows.map((row) => row.starterCode),
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
      });
    });

    it("filters by both session ID and interviewer ID", async () => {
      const { client, selectQuery } = createFakeClient();

      await findSessionByIdForInterviewer(client, {
        interviewerId,
        sessionId,
      });

      const where = compileSql(selectQuery.where.mock.calls[0]?.[0]);
      expect(where.sql).toContain('"interview_sessions"."id" = $1');
      expect(where.sql).toContain('"interview_sessions"."interviewer_id" = $2');
      expect(where.params).toEqual([sessionId, interviewerId]);
    });
  });
});
