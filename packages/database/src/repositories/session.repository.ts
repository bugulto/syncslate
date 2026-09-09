import type {
  CandidateProblem,
  EditingPolicy,
  Participant,
  ProblemDetail,
  ProblemSummary,
  RoomSession,
  SessionDetail,
  SessionStatus,
  SessionSummary,
  SupportedLanguage,
} from "@syncslate/contracts";
import { and, asc, desc, eq } from "drizzle-orm";

import type { DatabaseClient } from "../client.js";
import {
  interviewSessions,
  problemStarterCode,
  problems,
  sessionParticipants,
} from "../schema.js";

export type CreateSessionInput = {
  interviewerId: string;
  interviewerDisplayName: string;
  problemId: string;
  title: string;
  language: SupportedLanguage;
  durationSeconds: number;
  status: SessionStatus;
  editingPolicy: EditingPolicy;
  timerState: unknown;
};

export type CreateSessionResult = SessionDetail;

export type ListSessionsByInterviewerInput = {
  interviewerId: string;
};

export type ListSessionsByInterviewerResult = SessionSummary[];

export type FindSessionByIdForInterviewerInput = {
  interviewerId: string;
  sessionId: string;
};

export type FindSessionByIdForInterviewerResult = SessionDetail | null;

export type RoomAccessPrincipal =
  { kind: "user"; userId: string } | { kind: "guest"; participantId: string };

export type FindAuthorizedRoomStateInput = {
  sessionId: string;
  principal: RoomAccessPrincipal;
};

export type AuthorizedRoomState = {
  session: RoomSession;
  problem: CandidateProblem | null;
  participants: Participant[];
};

export type FindAuthorizedRoomStateResult = AuthorizedRoomState | null;

export async function createSession(
  client: DatabaseClient,
  input: CreateSessionInput,
): Promise<CreateSessionResult> {
  const createdSessionId = await client.db.transaction(async (transaction) => {
    const [createdSession] = await transaction
      .insert(interviewSessions)
      .values({
        interviewerId: input.interviewerId,
        problemId: input.problemId,
        title: input.title,
        language: input.language,
        durationSeconds: input.durationSeconds,
        status: input.status,
        editingPolicy: input.editingPolicy,
        timerState: input.timerState,
      })
      .returning({ id: interviewSessions.id });

    if (createdSession === undefined) {
      throw new Error("Session insert did not return the created session");
    }

    await transaction.insert(sessionParticipants).values({
      sessionId: createdSession.id,
      userId: input.interviewerId,
      displayName: input.interviewerDisplayName,
      role: "interviewer",
    });

    return createdSession.id;
  });

  const session = await findSessionByIdForInterviewer(client, {
    interviewerId: input.interviewerId,
    sessionId: createdSessionId,
  });

  if (session === null) {
    throw new Error(
      `Created session ${createdSessionId} could not be loaded for its owner`,
    );
  }

  return session;
}

export async function listSessionsByInterviewer(
  client: DatabaseClient,
  input: ListSessionsByInterviewerInput,
): Promise<ListSessionsByInterviewerResult> {
  const rows = await client.db
    .select({
      session: {
        id: interviewSessions.id,
        title: interviewSessions.title,
        status: interviewSessions.status,
        language: interviewSessions.language,
        editingPolicy: interviewSessions.editingPolicy,
        durationSeconds: interviewSessions.durationSeconds,
        createdAt: interviewSessions.createdAt,
        updatedAt: interviewSessions.updatedAt,
      },
      problem: {
        id: problems.id,
        title: problems.title,
        slug: problems.slug,
        difficulty: problems.difficulty,
        tags: problems.tags,
        visibility: problems.visibility,
      },
      starterLanguage: problemStarterCode.language,
    })
    .from(interviewSessions)
    .leftJoin(problems, eq(problems.id, interviewSessions.problemId))
    .leftJoin(problemStarterCode, eq(problemStarterCode.problemId, problems.id))
    .where(eq(interviewSessions.interviewerId, input.interviewerId))
    .orderBy(
      desc(interviewSessions.createdAt),
      desc(interviewSessions.id),
      asc(problemStarterCode.language),
    );

  const sessions = new Map<string, SessionSummary>();

  for (const row of rows) {
    const existingSession = sessions.get(row.session.id);

    if (existingSession !== undefined) {
      if (
        existingSession.problem !== null &&
        row.starterLanguage !== null &&
        !existingSession.problem.availableLanguages.includes(
          row.starterLanguage,
        )
      ) {
        existingSession.problem.availableLanguages.push(row.starterLanguage);
      }

      continue;
    }

    let problem: ProblemSummary | null = null;

    if (row.problem !== null) {
      problem = {
        ...row.problem,
        availableLanguages:
          row.starterLanguage === null ? [] : [row.starterLanguage],
      };
    }

    sessions.set(row.session.id, {
      ...row.session,
      problem,
      createdAt: row.session.createdAt.toISOString(),
      updatedAt: row.session.updatedAt.toISOString(),
    });
  }

  return [...sessions.values()];
}

export async function findSessionByIdForInterviewer(
  client: DatabaseClient,
  input: FindSessionByIdForInterviewerInput,
): Promise<FindSessionByIdForInterviewerResult> {
  const rows = await client.db
    .select({
      session: {
        id: interviewSessions.id,
        title: interviewSessions.title,
        status: interviewSessions.status,
        language: interviewSessions.language,
        editingPolicy: interviewSessions.editingPolicy,
        durationSeconds: interviewSessions.durationSeconds,
        startedAt: interviewSessions.startedAt,
        endedAt: interviewSessions.endedAt,
        createdAt: interviewSessions.createdAt,
        updatedAt: interviewSessions.updatedAt,
      },
      problem: {
        id: problems.id,
        title: problems.title,
        slug: problems.slug,
        difficulty: problems.difficulty,
        tags: problems.tags,
        visibility: problems.visibility,
        descriptionMarkdown: problems.descriptionMarkdown,
        constraintsMarkdown: problems.constraintsMarkdown,
        examples: problems.examples,
        interviewerNotesMarkdown: problems.interviewerNotesMarkdown,
        createdAt: problems.createdAt,
        updatedAt: problems.updatedAt,
      },
      starterCode: {
        language: problemStarterCode.language,
        code: problemStarterCode.code,
      },
    })
    .from(interviewSessions)
    .leftJoin(problems, eq(problems.id, interviewSessions.problemId))
    .leftJoin(problemStarterCode, eq(problemStarterCode.problemId, problems.id))
    .where(
      and(
        eq(interviewSessions.id, input.sessionId),
        eq(interviewSessions.interviewerId, input.interviewerId),
      ),
    )
    .orderBy(asc(problemStarterCode.language));

  const firstRow = rows[0];

  if (firstRow === undefined) {
    return null;
  }

  let problem: ProblemDetail | null = null;

  if (firstRow.problem !== null) {
    const starterCode = rows.flatMap((row) =>
      row.starterCode === null ? [] : [row.starterCode],
    );

    problem = {
      ...firstRow.problem,
      availableLanguages: starterCode.map((entry) => entry.language),
      starterCode,
      createdAt: firstRow.problem.createdAt.toISOString(),
      updatedAt: firstRow.problem.updatedAt.toISOString(),
    };
  }

  return {
    ...firstRow.session,
    problem,
    startedAt: firstRow.session.startedAt?.toISOString() ?? null,
    endedAt: firstRow.session.endedAt?.toISOString() ?? null,
    createdAt: firstRow.session.createdAt.toISOString(),
    updatedAt: firstRow.session.updatedAt.toISOString(),
  };
}

export async function findAuthorizedRoomState(
  client: DatabaseClient,
  input: FindAuthorizedRoomStateInput,
): Promise<FindAuthorizedRoomStateResult> {
  const hasAccess =
    input.principal.kind === "user"
      ? await client.db
          .select({ id: interviewSessions.id })
          .from(interviewSessions)
          .where(
            and(
              eq(interviewSessions.id, input.sessionId),
              eq(interviewSessions.interviewerId, input.principal.userId),
            ),
          )
          .limit(1)
      : await client.db
          .select({ id: sessionParticipants.id })
          .from(sessionParticipants)
          .where(
            and(
              eq(sessionParticipants.sessionId, input.sessionId),
              eq(sessionParticipants.id, input.principal.participantId),
            ),
          )
          .limit(1);

  if (hasAccess.length === 0) {
    return null;
  }

  const [room] = await client.db
    .select({
      session: {
        id: interviewSessions.id,
        title: interviewSessions.title,
        status: interviewSessions.status,
        language: interviewSessions.language,
        editingPolicy: interviewSessions.editingPolicy,
        durationSeconds: interviewSessions.durationSeconds,
        startedAt: interviewSessions.startedAt,
      },
      problem: {
        id: problems.id,
        title: problems.title,
        difficulty: problems.difficulty,
        tags: problems.tags,
        descriptionMarkdown: problems.descriptionMarkdown,
        constraintsMarkdown: problems.constraintsMarkdown,
        examples: problems.examples,
      },
    })
    .from(interviewSessions)
    .leftJoin(problems, eq(problems.id, interviewSessions.problemId))
    .where(eq(interviewSessions.id, input.sessionId))
    .limit(1);

  if (room === undefined) {
    return null;
  }

  const participants = await client.db
    .select({
      id: sessionParticipants.id,
      displayName: sessionParticipants.displayName,
      role: sessionParticipants.role,
    })
    .from(sessionParticipants)
    .where(eq(sessionParticipants.sessionId, input.sessionId))
    .orderBy(asc(sessionParticipants.createdAt), asc(sessionParticipants.id));

  return {
    session: {
      ...room.session,
      startedAt: room.session.startedAt?.toISOString() ?? null,
    },
    problem: room.problem,
    participants,
  };
}
