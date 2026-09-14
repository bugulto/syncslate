import type { Participant } from "@syncslate/contracts";

export type RoomSocket = {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  terminate(): void;
};

type ParticipantEntry = {
  participant: Participant;
  sockets: Set<RoomSocket>;
};

type RoomEntry = {
  participants: Map<string, ParticipantEntry>;
};

type SocketBinding = {
  sessionId: string;
  participantId: string;
};

export type RegisterRoomSocketInput = {
  sessionId: string;
  participant: Participant;
  socket: RoomSocket;
};

export type RegisterRoomSocketResult =
  | {
      kind: "participant_connected" | "socket_added" | "already_registered";
      participant: Participant;
      socketCount: number;
    }
  | { kind: "conflict" };

export type UnregisterRoomSocketResult =
  | { kind: "not_registered" }
  | {
      kind: "socket_removed" | "participant_disconnected";
      sessionId: string;
      participant: Participant;
      remainingSocketCount: number;
    };

function participantsMatch(left: Participant, right: Participant): boolean {
  return (
    left.id === right.id &&
    left.displayName === right.displayName &&
    left.role === right.role
  );
}

export class RoomRegistry {
  readonly #rooms = new Map<string, RoomEntry>();
  readonly #socketBindings = new Map<RoomSocket, SocketBinding>();

  register(input: RegisterRoomSocketInput): RegisterRoomSocketResult {
    const existingBinding = this.#socketBindings.get(input.socket);

    if (existingBinding !== undefined) {
      if (
        existingBinding.sessionId !== input.sessionId ||
        existingBinding.participantId !== input.participant.id
      ) {
        return { kind: "conflict" };
      }

      const existingEntry = this.#rooms
        .get(input.sessionId)
        ?.participants.get(input.participant.id);

      if (
        existingEntry === undefined ||
        !participantsMatch(existingEntry.participant, input.participant)
      ) {
        return { kind: "conflict" };
      }

      return {
        kind: "already_registered",
        participant: { ...existingEntry.participant },
        socketCount: existingEntry.sockets.size,
      };
    }

    let room = this.#rooms.get(input.sessionId);

    if (room === undefined) {
      room = { participants: new Map() };
      this.#rooms.set(input.sessionId, room);
    }

    const occupiedRole = [...room.participants.values()].find(
      (entry) =>
        entry.participant.role === input.participant.role &&
        entry.participant.id !== input.participant.id,
    );
    if (occupiedRole !== undefined) {
      return { kind: "conflict" };
    }

    const existingParticipant = room.participants.get(input.participant.id);

    if (
      existingParticipant !== undefined &&
      !participantsMatch(existingParticipant.participant, input.participant)
    ) {
      return { kind: "conflict" };
    }

    const entry = existingParticipant ?? {
      participant: { ...input.participant },
      sockets: new Set<RoomSocket>(),
    };
    const isFirstSocket = entry.sockets.size === 0;

    entry.sockets.add(input.socket);
    room.participants.set(input.participant.id, entry);
    this.#socketBindings.set(input.socket, {
      sessionId: input.sessionId,
      participantId: input.participant.id,
    });

    return {
      kind: isFirstSocket ? "participant_connected" : "socket_added",
      participant: { ...entry.participant },
      socketCount: entry.sockets.size,
    };
  }

  unregister(socket: RoomSocket): UnregisterRoomSocketResult {
    const binding = this.#socketBindings.get(socket);

    if (binding === undefined) {
      return { kind: "not_registered" };
    }

    this.#socketBindings.delete(socket);
    const room = this.#rooms.get(binding.sessionId);
    const entry = room?.participants.get(binding.participantId);

    if (room === undefined || entry === undefined) {
      return { kind: "not_registered" };
    }

    entry.sockets.delete(socket);

    if (entry.sockets.size > 0) {
      return {
        kind: "socket_removed",
        sessionId: binding.sessionId,
        participant: { ...entry.participant },
        remainingSocketCount: entry.sockets.size,
      };
    }

    room.participants.delete(binding.participantId);
    if (room.participants.size === 0) {
      this.#rooms.delete(binding.sessionId);
    }

    return {
      kind: "participant_disconnected",
      sessionId: binding.sessionId,
      participant: { ...entry.participant },
      remainingSocketCount: 0,
    };
  }

  getConnectedParticipants(sessionId: string): Participant[] {
    const participants = [
      ...(this.#rooms.get(sessionId)?.participants.values() ?? []),
    ].map((entry) => ({ ...entry.participant }));

    return participants.sort((left, right) => {
      if (left.role !== right.role) {
        return left.role === "interviewer" ? -1 : 1;
      }

      return left.id.localeCompare(right.id);
    });
  }

  getRoomSockets(sessionId: string): RoomSocket[] {
    const room = this.#rooms.get(sessionId);

    return room === undefined
      ? []
      : [...room.participants.values()].flatMap((entry) => [...entry.sockets]);
  }

  getParticipantSocketCount(sessionId: string, participantId: string): number {
    return (
      this.#rooms.get(sessionId)?.participants.get(participantId)?.sockets
        .size ?? 0
    );
  }

  get roomCount(): number {
    return this.#rooms.size;
  }

  get socketCount(): number {
    return this.#socketBindings.size;
  }

  drain(): RoomSocket[] {
    const sockets = [...this.#socketBindings.keys()];

    this.#socketBindings.clear();
    this.#rooms.clear();

    return sockets;
  }
}

export function createRoomRegistry(): RoomRegistry {
  return new RoomRegistry();
}
