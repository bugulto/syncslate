import websocket from "@fastify/websocket";
import {
  roomErrorEventSchema,
  roomJoinedEventSchema,
  presenceChangedEventSchema,
  type RoomJoinCommand,
} from "@syncslate/contracts";
import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WebSocket } from "ws";

import type { RoomAccessAuthorizer } from "./room-access.js";
import type { RoomAuthenticator } from "./room-auth.js";
import type { RoomEventWriter } from "./room-event-writer.js";
import { createRoomRegistry, type RoomRegistry } from "./room-registry.js";
import { roomRoutes } from "./room.routes.js";

const webOrigin = "http://localhost:3000";
const sessionId = "30000000-0000-4000-8000-000000000001";
const clientEventId = "60000000-0000-4000-8000-000000000001";
const userId = "550e8400-e29b-41d4-a716-446655440000";
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
const roomState = {
  session: {
    id: sessionId,
    title: "Backend interview",
    status: "waiting" as const,
    language: "typescript" as const,
    editingPolicy: "candidate_only" as const,
    durationSeconds: 3600,
    startedAt: null,
  },
  problem: null,
  participants: [interviewer, candidate],
};

const joinCommand = {
  type: "room.join",
  clientEventId,
  payload: {
    sessionId,
    credential: {
      kind: "user",
      accessToken: "verified-access-token",
    },
  },
} satisfies RoomJoinCommand;

const apps = new Set<ReturnType<typeof Fastify>>();
const sockets = new Set<WebSocket>();

async function nextMessage(socket: WebSocket): Promise<unknown> {
  return new Promise((resolve, reject) => {
    socket.once("message", (data) => {
      try {
        resolve(JSON.parse(data.toString()) as unknown);
      } catch (error) {
        reject(error);
      }
    });
    socket.once("error", reject);
  });
}

async function nextClose(socket: WebSocket): Promise<number> {
  return new Promise((resolve) => {
    socket.once("close", (code) => resolve(code));
  });
}

async function buildRoomApp(options?: {
  authenticateRoom?: RoomAuthenticator;
  authorizeRoomJoin?: RoomAccessAuthorizer;
  authenticationTimeoutMs?: number;
  registry?: RoomRegistry;
  eventWriter?: RoomEventWriter;
  disconnectGraceMs?: number;
}) {
  const app = Fastify({ logger: false });
  const registry = options?.registry ?? createRoomRegistry();
  const authenticateRoom =
    options?.authenticateRoom ??
    vi.fn<RoomAuthenticator>().mockResolvedValue({
      kind: "authenticated",
      principal: { kind: "user", userId },
    });
  const authorizeRoomJoin =
    options?.authorizeRoomJoin ??
    vi.fn<RoomAccessAuthorizer>().mockResolvedValue({
      kind: "authorized",
      participant: interviewer,
      state: roomState,
    });
  const storedEvent = (type: string, sequence = 1) => ({
    id: "70000000-0000-4000-8000-000000000001",
    sessionId,
    sequence,
    actorParticipantId: interviewer.id,
    type,
    schemaVersion: 1,
    payload: {},
    occurredAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  });
  const eventWriter =
    options?.eventWriter ??
    ({
      recordParticipantConnected: vi
        .fn()
        .mockResolvedValue(storedEvent("participant.joined")),
      recordParticipantDisconnected: vi
        .fn()
        .mockResolvedValue(storedEvent("participant.disconnected", 2)),
      recordSessionStarted: vi
        .fn()
        .mockResolvedValue(storedEvent("session.started", 3)),
      flush: vi.fn().mockResolvedValue(undefined),
    } satisfies RoomEventWriter);

  app.register(websocket, { options: { maxPayload: 32_768 } });
  app.register(roomRoutes, {
    prefix: "/api/v1",
    allowedOrigins: [webOrigin],
    authenticationTimeoutMs: options?.authenticationTimeoutMs ?? 5_000,
    heartbeatIntervalMs: 60_000,
    disconnectGraceMs: options?.disconnectGraceMs ?? 1_000,
    authenticateRoom,
    authorizeRoomJoin,
    eventWriter,
    registry,
  });
  await app.ready();
  apps.add(app);

  return { app, authenticateRoom, authorizeRoomJoin, registry, eventWriter };
}

async function connect(app: ReturnType<typeof Fastify>): Promise<WebSocket> {
  const socket = await app.injectWS("/api/v1/rooms/socket", {
    headers: { origin: webOrigin },
  });
  sockets.add(socket);
  return socket;
}

afterEach(async () => {
  for (const socket of sockets) {
    socket.terminate();
  }
  sockets.clear();
  await Promise.all([...apps].map((app) => app.close()));
  apps.clear();
  vi.clearAllMocks();
});

describe("room WebSocket route", () => {
  it("rejects untrusted origins during the upgrade", async () => {
    const { app } = await buildRoomApp();

    await expect(
      app.injectWS("/api/v1/rooms/socket", {
        headers: { origin: "https://attacker.example.com" },
      }),
    ).rejects.toThrow("Unexpected server response: 403");
  });

  it("returns structured errors for malformed and unknown messages", async () => {
    const { app } = await buildRoomApp();
    const socket = await connect(app);

    let response = nextMessage(socket);
    socket.send("not-json");
    expect(roomErrorEventSchema.parse(await response).payload.code).toBe(
      "VALIDATION_ERROR",
    );

    response = nextMessage(socket);
    socket.send(JSON.stringify({ type: "timer.tick", payload: {} }));
    expect(roomErrorEventSchema.parse(await response).payload.code).toBe(
      "UNKNOWN_EVENT",
    );
  });

  it("authenticates, authorizes, registers, and returns candidate-safe state", async () => {
    const { app, authenticateRoom, authorizeRoomJoin, registry } =
      await buildRoomApp();
    const socket = await connect(app);
    const response = nextMessage(socket);

    socket.send(JSON.stringify(joinCommand));
    const joined = roomJoinedEventSchema.parse(await response);

    expect(joined).toMatchObject({
      roomId: sessionId,
      actorParticipantId: interviewer.id,
      clientEventId,
      type: "room.joined",
      payload: {
        participant: interviewer,
        state: {
          session: roomState.session,
          problem: null,
          presence: [
            { participant: interviewer, status: "connected" },
            { participant: candidate, status: "disconnected" },
          ],
        },
      },
    });
    expect(authenticateRoom).toHaveBeenCalledWith({
      sessionId,
      credential: joinCommand.payload.credential,
    });
    expect(authorizeRoomJoin).toHaveBeenCalledWith({
      sessionId,
      principal: { kind: "user", userId },
    });
    expect(registry.getParticipantSocketCount(sessionId, interviewer.id)).toBe(
      1,
    );

    const closed = nextClose(socket);
    socket.terminate();
    await closed;
    await vi.waitFor(() => {
      expect(
        registry.getParticipantSocketCount(sessionId, interviewer.id),
      ).toBe(0);
    });
  });

  it("treats duplicate joins and extra tabs idempotently", async () => {
    const { app, registry, eventWriter } = await buildRoomApp();
    const first = await connect(app);
    let response = nextMessage(first);
    first.send(JSON.stringify(joinCommand));
    const original = await response;

    response = nextMessage(first);
    first.send(JSON.stringify(joinCommand));
    expect(await response).toEqual(original);

    const second = await connect(app);
    response = nextMessage(second);
    second.send(
      JSON.stringify({
        ...joinCommand,
        clientEventId: "60000000-0000-4000-8000-000000000002",
      }),
    );
    roomJoinedEventSchema.parse(await response);

    expect(registry.getParticipantSocketCount(sessionId, interviewer.id)).toBe(
      2,
    );
    expect(eventWriter.recordParticipantConnected).toHaveBeenCalledTimes(1);

    first.terminate();
    await vi.waitFor(() => {
      expect(
        registry.getParticipantSocketCount(sessionId, interviewer.id),
      ).toBe(1);
    });
    expect(eventWriter.recordParticipantDisconnected).not.toHaveBeenCalled();
  });

  it("broadcasts presence to existing sockets in the room", async () => {
    const authorizeRoomJoin = vi
      .fn<RoomAccessAuthorizer>()
      .mockResolvedValueOnce({
        kind: "authorized",
        participant: interviewer,
        state: roomState,
      })
      .mockResolvedValueOnce({
        kind: "authorized",
        participant: candidate,
        state: roomState,
      });
    const { app } = await buildRoomApp({ authorizeRoomJoin });
    const interviewerSocket = await connect(app);
    let response = nextMessage(interviewerSocket);
    interviewerSocket.send(JSON.stringify(joinCommand));
    await response;

    const candidateSocket = await connect(app);
    const presenceBroadcast = nextMessage(interviewerSocket);
    response = nextMessage(candidateSocket);
    candidateSocket.send(
      JSON.stringify({
        ...joinCommand,
        clientEventId: "60000000-0000-4000-8000-000000000003",
      }),
    );
    roomJoinedEventSchema.parse(await response);

    const changed = presenceChangedEventSchema.parse(await presenceBroadcast);
    expect(changed.payload.presence).toEqual([
      expect.objectContaining({
        participant: interviewer,
        status: "connected",
      }),
      expect.objectContaining({ participant: candidate, status: "connected" }),
    ]);
  });

  it("persists a disconnect only after the grace period", async () => {
    const { app, eventWriter } = await buildRoomApp({ disconnectGraceMs: 10 });
    const socket = await connect(app);
    const response = nextMessage(socket);
    socket.send(JSON.stringify(joinCommand));
    await response;
    socket.terminate();

    await vi.waitFor(() => {
      expect(eventWriter.recordParticipantDisconnected).toHaveBeenCalledTimes(
        1,
      );
    });
  });

  it("reauthenticates a reconnect without duplicating presence transitions", async () => {
    const { app, authenticateRoom, eventWriter } = await buildRoomApp({
      disconnectGraceMs: 30,
    });
    const first = await connect(app);
    let response = nextMessage(first);
    first.send(JSON.stringify(joinCommand));
    await response;
    first.terminate();

    const second = await connect(app);
    response = nextMessage(second);
    second.send(
      JSON.stringify({
        ...joinCommand,
        clientEventId: "60000000-0000-4000-8000-000000000004",
      }),
    );
    const joined = roomJoinedEventSchema.parse(await response);
    expect(joined.payload.state.presence[0]?.status).toBe("connected");

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(authenticateRoom).toHaveBeenCalledTimes(2);
    expect(eventWriter.recordParticipantConnected).toHaveBeenCalledTimes(1);
    expect(eventWriter.recordParticipantDisconnected).not.toHaveBeenCalled();
  });

  it.each([
    [
      "authentication failure",
      { kind: "invalid" } as const,
      undefined,
      "UNAUTHORIZED",
      4_401,
    ],
    [
      "unrelated principal",
      {
        kind: "authenticated",
        principal: { kind: "user", userId },
      } as const,
      { kind: "forbidden" } as const,
      "FORBIDDEN",
      4_403,
    ],
    [
      "closed session",
      {
        kind: "authenticated",
        principal: { kind: "user", userId },
      } as const,
      { kind: "session_closed" } as const,
      "SESSION_CLOSED",
      4_403,
    ],
  ])(
    "safely closes on %s",
    async (_, authentication, access, errorCode, closeCode) => {
      const authenticateRoom = vi
        .fn<RoomAuthenticator>()
        .mockResolvedValue(authentication);
      const authorizeRoomJoin = vi
        .fn<RoomAccessAuthorizer>()
        .mockResolvedValue(access ?? { kind: "forbidden" });
      const { app, registry } = await buildRoomApp({
        authenticateRoom,
        authorizeRoomJoin,
      });
      const socket = await connect(app);
      const response = nextMessage(socket);
      const closed = nextClose(socket);

      socket.send(JSON.stringify(joinCommand));

      expect(roomErrorEventSchema.parse(await response).payload.code).toBe(
        errorCode,
      );
      await expect(closed).resolves.toBe(closeCode);
      expect(registry.socketCount).toBe(0);
    },
  );

  it("closes clients that do not authenticate before the deadline", async () => {
    const { app } = await buildRoomApp({ authenticationTimeoutMs: 20 });
    const socket = await connect(app);
    const response = nextMessage(socket);
    const closed = nextClose(socket);

    expect(roomErrorEventSchema.parse(await response).payload).toEqual({
      code: "UNAUTHORIZED",
      message: "Room authentication timed out.",
    });
    await expect(closed).resolves.toBe(4_401);
  });
});
