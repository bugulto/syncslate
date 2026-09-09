import { createHash, randomUUID } from "node:crypto";

import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabaseClient, type DatabaseClient } from "../client.js";
import {
  interviewSessions,
  problems,
  problemStarterCode,
  profiles,
  sessionInvitations,
  sessionParticipants,
} from "../schema.js";
import {
  admitCandidateByTokenHash,
  createInvitationForOwnedSession,
  findInvitationByTokenHash,
  revokeInvitationForOwnedSession,
} from "./invitation.repository.js";
import {
  findCandidateParticipant,
  findInterviewerParticipant,
  findParticipantById,
  listParticipantsBySession,
} from "./participant.repository.js";
import {
  findVisibleProblemById,
  searchVisibleProblems,
} from "./problem.repository.js";
import {
  createSession,
  findAuthorizedRoomState,
  findSessionByIdForInterviewer,
  listSessionsByInterviewer,
} from "./session.repository.js";

class RollbackIntegrationTest extends Error {}

describe("database repositories integration", () => {
  let client: DatabaseClient;

  beforeAll(() => {
    const directDatabaseUrl = process.env.DIRECT_DATABASE_URL?.trim();

    client = createDatabaseClient({
      connectionString: directDatabaseUrl || process.env.DATABASE_URL,
      maxConnections: 4,
    });
  });

  afterAll(async () => {
    await client.close();
  });

  it("enforces problem, session, and invitation ownership", async () => {
    const ownerId = randomUUID();
    const otherOwnerId = randomUUID();
    const seededProblemId = randomUUID();
    const ownedProblemId = randomUUID();
    const otherProblemId = randomUUID();
    const marker = randomUUID().slice(0, 8);

    try {
      await client.db.transaction(async (transaction) => {
        await transaction.execute(sql`
          insert into auth.users (
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            created_at,
            updated_at
          )
          values
            (
              ${ownerId}::uuid,
              'authenticated',
              'authenticated',
              ${`repository-owner-${marker}@example.com`},
              '',
              now(),
              now(),
              now()
            ),
            (
              ${otherOwnerId}::uuid,
              'authenticated',
              'authenticated',
              ${`repository-other-${marker}@example.com`},
              '',
              now(),
              now(),
              now()
            )
        `);

        await transaction.insert(profiles).values([
          { id: ownerId, displayName: "Repository Owner" },
          { id: otherOwnerId, displayName: "Other Owner" },
        ]);

        await transaction.insert(problems).values([
          {
            id: seededProblemId,
            ownerId: null,
            visibility: "seeded",
            title: `Seeded Repository ${marker}`,
            slug: `seeded-repository-${marker}`,
            descriptionMarkdown: "Seeded repository problem.",
            difficulty: "easy",
            tags: ["repository-seeded"],
            constraintsMarkdown: null,
            examples: [],
            interviewerNotesMarkdown: null,
          },
          {
            id: ownedProblemId,
            ownerId,
            visibility: "private",
            title: `Owned Repository Sum ${marker}`,
            slug: `owned-repository-sum-${marker}`,
            descriptionMarkdown: "Owned repository problem.",
            difficulty: "medium",
            tags: ["repository-owned", marker],
            constraintsMarkdown: null,
            examples: [],
            interviewerNotesMarkdown: null,
          },
          {
            id: otherProblemId,
            ownerId: otherOwnerId,
            visibility: "private",
            title: `Other Repository ${marker}`,
            slug: `other-repository-${marker}`,
            descriptionMarkdown: "Another owner's repository problem.",
            difficulty: "hard",
            tags: ["repository-other"],
            constraintsMarkdown: null,
            examples: [],
            interviewerNotesMarkdown: null,
          },
        ]);

        await transaction.insert(problemStarterCode).values([
          {
            id: randomUUID(),
            problemId: seededProblemId,
            language: "javascript",
            code: "export function seeded() {}",
          },
          {
            id: randomUUID(),
            problemId: ownedProblemId,
            language: "typescript",
            code: "export function owned() {}",
          },
          {
            id: randomUUID(),
            problemId: ownedProblemId,
            language: "python",
            code: "def owned(): pass",
          },
          {
            id: randomUUID(),
            problemId: otherProblemId,
            language: "typescript",
            code: "export function other() {}",
          },
        ]);

        const transactionClient = {
          db: transaction,
        } as unknown as DatabaseClient;

        const visibleProblems = await searchVisibleProblems(transactionClient, {
          requesterId: ownerId,
        });
        expect(visibleProblems.some(({ id }) => id === seededProblemId)).toBe(
          true,
        );
        expect(visibleProblems.some(({ id }) => id === ownedProblemId)).toBe(
          true,
        );
        expect(visibleProblems.some(({ id }) => id === otherProblemId)).toBe(
          false,
        );

        const filteredProblems = await searchVisibleProblems(
          transactionClient,
          {
            requesterId: ownerId,
            q: `sum ${marker}`,
            difficulty: "medium",
            tag: marker,
            language: "python",
          },
        );
        expect(filteredProblems.map(({ id }) => id)).toEqual([ownedProblemId]);
        expect(filteredProblems[0]?.availableLanguages).toEqual([
          "typescript",
          "python",
        ]);

        await expect(
          findVisibleProblemById(transactionClient, {
            requesterId: ownerId,
            problemId: otherProblemId,
          }),
        ).resolves.toBeNull();
        const ownedProblem = await findVisibleProblemById(transactionClient, {
          requesterId: ownerId,
          problemId: ownedProblemId,
        });
        expect(ownedProblem?.starterCode).toHaveLength(2);

        const ownerSession = await createSession(transactionClient, {
          interviewerId: ownerId,
          interviewerDisplayName: "Repository Owner",
          problemId: ownedProblemId,
          title: `Owner session ${marker}`,
          language: "typescript",
          durationSeconds: 3600,
          status: "waiting",
          editingPolicy: "candidate_only",
          timerState: { status: "idle", durationMs: 3_600_000 },
        });
        const otherSession = await createSession(transactionClient, {
          interviewerId: otherOwnerId,
          interviewerDisplayName: "Other Owner",
          problemId: otherProblemId,
          title: `Other session ${marker}`,
          language: "typescript",
          durationSeconds: 3600,
          status: "waiting",
          editingPolicy: "candidate_only",
          timerState: { status: "idle", durationMs: 3_600_000 },
        });

        const ownerSessions = await listSessionsByInterviewer(
          transactionClient,
          { interviewerId: ownerId },
        );
        expect(ownerSessions.map(({ id }) => id)).toEqual([ownerSession.id]);
        expect(ownerSessions.some(({ id }) => id === otherSession.id)).toBe(
          false,
        );

        const [ownerParticipant] = await transaction
          .select()
          .from(sessionParticipants)
          .where(eq(sessionParticipants.sessionId, ownerSession.id));
        expect(ownerParticipant).toMatchObject({
          sessionId: ownerSession.id,
          userId: ownerId,
          displayName: "Repository Owner",
          role: "interviewer",
          joinedAt: null,
          leftAt: null,
        });

        await expect(
          findParticipantById(transactionClient, ownerParticipant!.id),
        ).resolves.toEqual(ownerParticipant);
        await expect(
          findInterviewerParticipant(transactionClient, ownerSession.id),
        ).resolves.toEqual(ownerParticipant);
        await expect(
          findCandidateParticipant(transactionClient, ownerSession.id),
        ).resolves.toBeNull();

        const [candidateParticipant] = await transaction
          .insert(sessionParticipants)
          .values({
            sessionId: ownerSession.id,
            displayName: "Repository Candidate",
            role: "candidate",
          })
          .returning();
        const participants = await listParticipantsBySession(
          transactionClient,
          ownerSession.id,
        );
        expect(participants).toEqual([ownerParticipant, candidateParticipant]);
        await expect(
          findCandidateParticipant(transactionClient, ownerSession.id),
        ).resolves.toEqual(candidateParticipant);

        const ownerRoomState = await findAuthorizedRoomState(
          transactionClient,
          {
            sessionId: ownerSession.id,
            principal: { kind: "user", userId: ownerId },
          },
        );
        expect(ownerRoomState).toMatchObject({
          session: { id: ownerSession.id, status: "waiting" },
          problem: { id: ownedProblemId },
          participants: [
            { id: ownerParticipant?.id, role: "interviewer" },
            { id: candidateParticipant?.id, role: "candidate" },
          ],
        });
        expect(ownerRoomState?.problem).not.toHaveProperty(
          "interviewerNotesMarkdown",
        );
        await expect(
          findAuthorizedRoomState(transactionClient, {
            sessionId: ownerSession.id,
            principal: {
              kind: "guest",
              participantId: candidateParticipant!.id,
            },
          }),
        ).resolves.toEqual(ownerRoomState);
        await expect(
          findAuthorizedRoomState(transactionClient, {
            sessionId: ownerSession.id,
            principal: { kind: "user", userId: otherOwnerId },
          }),
        ).resolves.toBeNull();

        const rolledBackSessionTitle = `Rolled back session ${marker}`;
        await expect(
          createSession(transactionClient, {
            interviewerId: ownerId,
            interviewerDisplayName: " ",
            problemId: ownedProblemId,
            title: rolledBackSessionTitle,
            language: "typescript",
            durationSeconds: 3600,
            status: "waiting",
            editingPolicy: "candidate_only",
            timerState: { status: "idle", durationMs: 3_600_000 },
          }),
        ).rejects.toThrow();
        const rolledBackSessions = await transaction
          .select({ id: interviewSessions.id })
          .from(interviewSessions)
          .where(eq(interviewSessions.title, rolledBackSessionTitle));
        expect(rolledBackSessions).toHaveLength(0);

        await expect(
          findSessionByIdForInterviewer(transactionClient, {
            interviewerId: otherOwnerId,
            sessionId: ownerSession.id,
          }),
        ).resolves.toBeNull();

        const rawToken = `raw_${randomUUID().replaceAll("-", "")}`;
        const tokenHash = createHash("sha256")
          .update(`${rawToken}:integration-pepper`)
          .digest("hex");
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
        const invitation = await createInvitationForOwnedSession(
          transactionClient,
          {
            interviewerId: ownerId,
            sessionId: ownerSession.id,
            tokenHash,
            expiresAt,
          },
        );

        expect(invitation).not.toBeNull();
        expect(invitation).not.toHaveProperty("tokenHash");
        expect(invitation).not.toHaveProperty("rawToken");
        const invitationLookup = await findInvitationByTokenHash(
          transactionClient,
          { tokenHash },
        );
        expect(invitationLookup).toMatchObject({
          id: invitation?.id,
          sessionId: ownerSession.id,
          sessionStatus: "waiting",
        });
        expect(invitationLookup).not.toHaveProperty("tokenHash");
        expect(invitationLookup).not.toHaveProperty("rawToken");
        await expect(
          createInvitationForOwnedSession(transactionClient, {
            interviewerId: otherOwnerId,
            sessionId: ownerSession.id,
            tokenHash: "b".repeat(64),
            expiresAt,
          }),
        ).resolves.toBeNull();

        const [storedInvitation] = await transaction
          .select()
          .from(sessionInvitations)
          .where(eq(sessionInvitations.id, invitation!.id));
        expect(storedInvitation?.tokenHash).toBe(tokenHash);
        expect(storedInvitation?.tokenHash).not.toBe(rawToken);

        await expect(
          revokeInvitationForOwnedSession(transactionClient, {
            interviewerId: otherOwnerId,
            sessionId: ownerSession.id,
            revokedAt: new Date(),
          }),
        ).resolves.toBeNull();

        const revokedAt = new Date();
        const revokedInvitation = await revokeInvitationForOwnedSession(
          transactionClient,
          {
            interviewerId: ownerId,
            sessionId: ownerSession.id,
            revokedAt,
          },
        );
        expect(revokedInvitation?.revokedAt).toBe(revokedAt.toISOString());

        const [persistedRevocation] = await transaction
          .select({ revokedAt: sessionInvitations.revokedAt })
          .from(sessionInvitations)
          .where(eq(sessionInvitations.id, invitation!.id));
        expect(persistedRevocation?.revokedAt).toEqual(revokedAt);

        const storedOwnerSessions = await transaction
          .select({ id: interviewSessions.id })
          .from(interviewSessions)
          .where(eq(interviewSessions.interviewerId, ownerId));
        expect(storedOwnerSessions).toHaveLength(1);

        throw new RollbackIntegrationTest();
      });
    } catch (error) {
      if (!(error instanceof RollbackIntegrationTest)) {
        throw error;
      }
    }
  });

  it("admits only one concurrent candidate and rolls back failed exchange", async () => {
    const ownerId = randomUUID();
    const problemId = randomUUID();
    const marker = randomUUID().slice(0, 8);
    let sessionId = "";
    let firstTokenHash = "";
    let secondTokenHash = "";

    try {
      await client.db.transaction(async (transaction) => {
        await transaction.execute(sql`
          insert into auth.users (
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            created_at,
            updated_at
          )
          values (
            ${ownerId}::uuid,
            'authenticated',
            'authenticated',
            ${`admission-owner-${marker}@example.com`},
            '',
            now(),
            now(),
            now()
          )
        `);
        await transaction.insert(profiles).values({
          id: ownerId,
          displayName: "Admission Owner",
        });
        await transaction.insert(problems).values({
          id: problemId,
          ownerId,
          visibility: "private",
          title: `Admission problem ${marker}`,
          slug: `admission-problem-${marker}`,
          descriptionMarkdown: "Admission test problem.",
          difficulty: "easy",
          tags: ["admission"],
          constraintsMarkdown: null,
          examples: [],
          interviewerNotesMarkdown: null,
        });
        await transaction.insert(problemStarterCode).values({
          problemId,
          language: "typescript",
          code: "export function admission() {}",
        });

        const transactionClient = {
          db: transaction,
        } as unknown as DatabaseClient;
        const session = await createSession(transactionClient, {
          interviewerId: ownerId,
          interviewerDisplayName: "Admission Owner",
          problemId,
          title: `Admission session ${marker}`,
          language: "typescript",
          durationSeconds: 3600,
          status: "waiting",
          editingPolicy: "candidate_only",
          timerState: { status: "idle", durationMs: 3_600_000 },
        });
        sessionId = session.id;
        firstTokenHash = createHash("sha256")
          .update(`first-${marker}`)
          .digest("hex");
        secondTokenHash = createHash("sha256")
          .update(`second-${marker}`)
          .digest("hex");
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

        await createInvitationForOwnedSession(transactionClient, {
          interviewerId: ownerId,
          sessionId,
          tokenHash: firstTokenHash,
          expiresAt,
        });
        await createInvitationForOwnedSession(transactionClient, {
          interviewerId: ownerId,
          sessionId,
          tokenHash: secondTokenHash,
          expiresAt,
        });
      });

      await expect(
        admitCandidateByTokenHash(client, {
          tokenHash: firstTokenHash,
          displayName: " ",
          now: new Date(),
        }),
      ).rejects.toThrow();
      const failedInvitation = await findInvitationByTokenHash(client, {
        tokenHash: firstTokenHash,
      });
      expect(failedInvitation?.consumedAt).toBeNull();
      await expect(
        findCandidateParticipant(client, sessionId),
      ).resolves.toBeNull();

      const results = await Promise.all([
        admitCandidateByTokenHash(client, {
          tokenHash: firstTokenHash,
          displayName: "First Candidate",
          now: new Date(),
        }),
        admitCandidateByTokenHash(client, {
          tokenHash: secondTokenHash,
          displayName: "Second Candidate",
          now: new Date(),
        }),
      ]);

      expect(results.map((result) => result.kind).sort()).toEqual([
        "joined",
        "session_full",
      ]);
      const candidates = await client.db
        .select()
        .from(sessionParticipants)
        .where(
          sql`${sessionParticipants.sessionId} = ${sessionId} and ${sessionParticipants.role} = 'candidate'`,
        );
      expect(candidates).toHaveLength(1);
      const invitations = await client.db
        .select({ consumedAt: sessionInvitations.consumedAt })
        .from(sessionInvitations)
        .where(eq(sessionInvitations.sessionId, sessionId));
      expect(
        invitations.filter((invitation) => invitation.consumedAt !== null),
      ).toHaveLength(1);
    } finally {
      await client.db.execute(
        sql`delete from auth.users where id = ${ownerId}::uuid`,
      );
    }
  });
});
