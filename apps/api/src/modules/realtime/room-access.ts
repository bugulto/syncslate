import type {
  AuthorizedRoomState,
  FindAuthorizedRoomStateInput,
  FindAuthorizedRoomStateResult,
} from "@syncslate/database";
import type { Participant } from "@syncslate/contracts";

import type { AuthPrincipal } from "../auth/auth-principal.js";

export type FindAuthorizedRoomState = (
  input: FindAuthorizedRoomStateInput,
) => Promise<FindAuthorizedRoomStateResult>;

export type AuthorizeRoomJoinInput = {
  sessionId: string;
  principal: AuthPrincipal;
};

export type AuthorizedRoomJoin = {
  kind: "authorized";
  participant: Participant;
  state: AuthorizedRoomState;
};

export type AuthorizeRoomJoinResult =
  AuthorizedRoomJoin | { kind: "forbidden" } | { kind: "session_closed" };

export type RoomAccessAuthorizer = (
  input: AuthorizeRoomJoinInput,
) => Promise<AuthorizeRoomJoinResult>;

function isClosedSession(status: AuthorizedRoomState["session"]["status"]) {
  return status === "completed" || status === "cancelled";
}

export function createRoomAccessAuthorizer(options: {
  findAuthorizedRoomState: FindAuthorizedRoomState;
}): RoomAccessAuthorizer {
  return async (input) => {
    if (
      input.principal.kind === "guest" &&
      (input.principal.sessionId !== input.sessionId ||
        input.principal.role !== "candidate")
    ) {
      return { kind: "forbidden" };
    }

    const state = await options.findAuthorizedRoomState({
      sessionId: input.sessionId,
      principal:
        input.principal.kind === "user"
          ? { kind: "user", userId: input.principal.userId }
          : {
              kind: "guest",
              participantId: input.principal.participantId,
            },
    });

    if (state === null) {
      return { kind: "forbidden" };
    }

    if (isClosedSession(state.session.status)) {
      return { kind: "session_closed" };
    }

    const participant = state.participants.find((entry) =>
      input.principal.kind === "user"
        ? entry.role === "interviewer"
        : entry.id === input.principal.participantId &&
          entry.role === "candidate",
    );

    if (participant === undefined) {
      return { kind: "forbidden" };
    }

    return { kind: "authorized", participant, state };
  };
}
