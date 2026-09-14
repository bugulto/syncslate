import type { AuthorizedRoomState } from "@syncslate/database";
import { describe, expect, it, vi } from "vitest";

import type { AuthPrincipal } from "../auth/auth-principal.js";
import { createRoomAccessAuthorizer } from "./room-access.js";

const sessionId = "30000000-0000-4000-8000-000000000001";
const otherSessionId = "30000000-0000-4000-8000-000000000002";
const participantId = "50000000-0000-4000-8000-000000000001";
const interviewerParticipantId = "50000000-0000-4000-8000-000000000002";
const userId = "550e8400-e29b-41d4-a716-446655440000";

const interviewer = {
  id: interviewerParticipantId,
  displayName: "Interviewer",
  role: "interviewer" as const,
};
const candidate = {
  id: participantId,
  displayName: "Candidate",
  role: "candidate" as const,
};
const waitingState = {
  session: {
    id: sessionId,
    title: "Backend interview",
    status: "waiting",
    language: "typescript",
    editingPolicy: "candidate_only",
    durationSeconds: 3600,
    startedAt: null,
  },
  problem: null,
  participants: [interviewer, candidate],
} satisfies AuthorizedRoomState;

describe("room access authorization", () => {
  it("admits an owning interviewer using trusted database state", async () => {
    const findAuthorizedRoomState = vi.fn().mockResolvedValue(waitingState);
    const authorize = createRoomAccessAuthorizer({
      findAuthorizedRoomState,
    });

    await expect(
      authorize({
        sessionId,
        principal: { kind: "user", userId },
      }),
    ).resolves.toEqual({
      kind: "authorized",
      participant: interviewer,
      state: waitingState,
    });
    expect(findAuthorizedRoomState).toHaveBeenCalledWith({
      sessionId,
      principal: { kind: "user", userId },
    });
  });

  it("admits only the candidate represented by a room-bound guest", async () => {
    const findAuthorizedRoomState = vi.fn().mockResolvedValue(waitingState);
    const authorize = createRoomAccessAuthorizer({
      findAuthorizedRoomState,
    });

    await expect(
      authorize({
        sessionId,
        principal: {
          kind: "guest",
          participantId,
          sessionId,
          role: "candidate",
        },
      }),
    ).resolves.toEqual({
      kind: "authorized",
      participant: candidate,
      state: waitingState,
    });
    expect(findAuthorizedRoomState).toHaveBeenCalledWith({
      sessionId,
      principal: { kind: "guest", participantId },
    });
  });

  it("rejects cross-room and forged-role guest principals before querying", async () => {
    const findAuthorizedRoomState = vi.fn();
    const authorize = createRoomAccessAuthorizer({
      findAuthorizedRoomState,
    });
    const forgedRolePrincipal = {
      kind: "guest",
      participantId,
      sessionId,
      role: "interviewer",
    } as unknown as AuthPrincipal;

    await expect(
      authorize({
        sessionId,
        principal: {
          kind: "guest",
          participantId,
          sessionId: otherSessionId,
          role: "candidate",
        },
      }),
    ).resolves.toEqual({ kind: "forbidden" });
    await expect(
      authorize({ sessionId, principal: forgedRolePrincipal }),
    ).resolves.toEqual({ kind: "forbidden" });
    expect(findAuthorizedRoomState).not.toHaveBeenCalled();
  });

  it("rejects unrelated principals and inconsistent participant state", async () => {
    const findAuthorizedRoomState = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        ...waitingState,
        participants: [interviewer],
      });
    const authorize = createRoomAccessAuthorizer({
      findAuthorizedRoomState,
    });

    await expect(
      authorize({
        sessionId,
        principal: { kind: "user", userId },
      }),
    ).resolves.toEqual({ kind: "forbidden" });
    await expect(
      authorize({
        sessionId,
        principal: {
          kind: "guest",
          participantId,
          sessionId,
          role: "candidate",
        },
      }),
    ).resolves.toEqual({ kind: "forbidden" });
  });

  it.each(["completed", "cancelled"] as const)(
    "rejects an authorized principal when the session is %s",
    async (status) => {
      const findAuthorizedRoomState = vi.fn().mockResolvedValue({
        ...waitingState,
        session: { ...waitingState.session, status },
      });
      const authorize = createRoomAccessAuthorizer({
        findAuthorizedRoomState,
      });

      await expect(
        authorize({
          sessionId,
          principal: { kind: "user", userId },
        }),
      ).resolves.toEqual({ kind: "session_closed" });
    },
  );
});
