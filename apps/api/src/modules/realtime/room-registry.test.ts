import { describe, expect, it, vi } from "vitest";

import { createRoomRegistry, type RoomSocket } from "./room-registry.js";

const firstSessionId = "30000000-0000-4000-8000-000000000001";
const secondSessionId = "30000000-0000-4000-8000-000000000002";
const interviewer = {
  id: "50000000-0000-4000-8000-000000000001",
  displayName: "Interviewer",
  role: "interviewer" as const,
};
const candidate = {
  id: "50000000-0000-4000-8000-000000000002",
  displayName: "Candidate",
  role: "candidate" as const,
};

function createSocket(): RoomSocket {
  return {
    readyState: 1,
    send: vi.fn(),
    close: vi.fn(),
    terminate: vi.fn(),
  };
}

describe("room registry", () => {
  it("registers participants and isolates sockets by room", () => {
    const registry = createRoomRegistry();
    const interviewerSocket = createSocket();
    const candidateSocket = createSocket();
    const otherRoomSocket = createSocket();

    expect(
      registry.register({
        sessionId: firstSessionId,
        participant: interviewer,
        socket: interviewerSocket,
      }),
    ).toMatchObject({ kind: "participant_connected", socketCount: 1 });
    registry.register({
      sessionId: firstSessionId,
      participant: candidate,
      socket: candidateSocket,
    });
    registry.register({
      sessionId: secondSessionId,
      participant: interviewer,
      socket: otherRoomSocket,
    });

    expect(registry.getRoomSockets(firstSessionId)).toEqual([
      interviewerSocket,
      candidateSocket,
    ]);
    expect(registry.getRoomSockets(secondSessionId)).toEqual([otherRoomSocket]);
    expect(registry.getConnectedParticipants(firstSessionId)).toEqual([
      interviewer,
      candidate,
    ]);
    expect(registry.roomCount).toBe(2);
    expect(registry.socketCount).toBe(3);
  });

  it("counts multiple sockets without duplicating participant presence", () => {
    const registry = createRoomRegistry();
    const firstSocket = createSocket();
    const secondSocket = createSocket();

    registry.register({
      sessionId: firstSessionId,
      participant: candidate,
      socket: firstSocket,
    });
    expect(
      registry.register({
        sessionId: firstSessionId,
        participant: candidate,
        socket: secondSocket,
      }),
    ).toMatchObject({ kind: "socket_added", socketCount: 2 });

    expect(registry.getConnectedParticipants(firstSessionId)).toEqual([
      candidate,
    ]);
    expect(
      registry.getParticipantSocketCount(firstSessionId, candidate.id),
    ).toBe(2);
    expect(registry.unregister(firstSocket)).toMatchObject({
      kind: "socket_removed",
      remainingSocketCount: 1,
    });
    expect(registry.getConnectedParticipants(firstSessionId)).toEqual([
      candidate,
    ]);
    expect(registry.unregister(secondSocket)).toMatchObject({
      kind: "participant_disconnected",
      remainingSocketCount: 0,
    });
    expect(registry.roomCount).toBe(0);
  });

  it("treats repeated registration of one socket as idempotent", () => {
    const registry = createRoomRegistry();
    const socket = createSocket();
    const input = {
      sessionId: firstSessionId,
      participant: candidate,
      socket,
    };

    registry.register(input);
    expect(registry.register(input)).toMatchObject({
      kind: "already_registered",
      socketCount: 1,
    });
    expect(registry.socketCount).toBe(1);
  });

  it("rejects socket rebinding and inconsistent participant identity", () => {
    const registry = createRoomRegistry();
    const socket = createSocket();

    registry.register({
      sessionId: firstSessionId,
      participant: candidate,
      socket,
    });
    expect(
      registry.register({
        sessionId: secondSessionId,
        participant: candidate,
        socket,
      }),
    ).toEqual({ kind: "conflict" });
    expect(
      registry.register({
        sessionId: firstSessionId,
        participant: { ...candidate, displayName: "Forged Name" },
        socket: createSocket(),
      }),
    ).toEqual({ kind: "conflict" });
    expect(
      registry.register({
        sessionId: firstSessionId,
        participant: { ...interviewer, id: candidate.id },
        socket: createSocket(),
      }),
    ).toEqual({ kind: "conflict" });
  });

  it("enforces one connected participant per role in a room", () => {
    const registry = createRoomRegistry();

    registry.register({
      sessionId: firstSessionId,
      participant: candidate,
      socket: createSocket(),
    });
    expect(
      registry.register({
        sessionId: firstSessionId,
        participant: {
          ...candidate,
          id: "50000000-0000-4000-8000-000000000099",
        },
        socket: createSocket(),
      }),
    ).toEqual({ kind: "conflict" });
  });

  it("handles unknown sockets and drains all registry state", () => {
    const registry = createRoomRegistry();
    const firstSocket = createSocket();
    const secondSocket = createSocket();

    expect(registry.unregister(firstSocket)).toEqual({
      kind: "not_registered",
    });
    registry.register({
      sessionId: firstSessionId,
      participant: interviewer,
      socket: firstSocket,
    });
    registry.register({
      sessionId: firstSessionId,
      participant: candidate,
      socket: secondSocket,
    });

    expect(registry.drain()).toEqual([firstSocket, secondSocket]);
    expect(registry.roomCount).toBe(0);
    expect(registry.socketCount).toBe(0);
    expect(registry.getRoomSockets(firstSessionId)).toEqual([]);
  });
});
