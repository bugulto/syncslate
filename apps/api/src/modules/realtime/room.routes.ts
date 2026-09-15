import { randomUUID } from "node:crypto";

import {
  roomClientCommandSchema,
  roomErrorEventSchema,
  roomJoinedEventSchema,
  type RoomErrorCode,
} from "@syncslate/contracts";
import type { FastifyPluginAsync } from "fastify";
import { WebSocket, type RawData } from "ws";

import type { RoomAccessAuthorizer } from "./room-access.js";
import { isAllowedRoomOrigin, type RoomAuthenticator } from "./room-auth.js";
import type { RoomEventWriter } from "./room-event-writer.js";
import type { HeartbeatSocket } from "./room-heartbeat.js";
import { createRoomPresenceCoordinator } from "./room-presence.js";
import {
  createRoomRegistry,
  type RoomRegistry,
  type RoomSocket,
} from "./room-registry.js";

const UNKNOWN_ROOM_ID = "00000000-0000-4000-8000-000000000000";
const CLOSE_UNAUTHORIZED = 4_401;
const CLOSE_FORBIDDEN = 4_403;

type ConnectionPhase = "awaiting_join" | "joining" | "joined" | "closed";

export type RoomRoutesOptions = {
  allowedOrigins: string[];
  authenticationTimeoutMs: number;
  heartbeatIntervalMs: number;
  disconnectGraceMs: number;
  authenticateRoom: RoomAuthenticator;
  authorizeRoomJoin: RoomAccessAuthorizer;
  eventWriter: RoomEventWriter;
  registry?: RoomRegistry;
};

function sendRoomError(
  socket: RoomSocket,
  input: {
    roomId: string | undefined;
    clientEventId?: string;
    code: RoomErrorCode;
    message: string;
  },
): void {
  if (socket.readyState !== WebSocket.OPEN) {
    return;
  }

  const event = roomErrorEventSchema.parse({
    eventId: randomUUID(),
    roomId: input.roomId ?? UNKNOWN_ROOM_ID,
    schemaVersion: 1,
    actorParticipantId: null,
    ...(input.clientEventId === undefined
      ? {}
      : { clientEventId: input.clientEventId }),
    occurredAt: new Date().toISOString(),
    type: "room.error",
    payload: {
      code: input.code,
      message: input.message,
    },
  });

  socket.send(JSON.stringify(event));
}

function decodeMessage(data: RawData, isBinary: boolean): unknown {
  if (isBinary) {
    throw new Error("Binary room messages are unsupported");
  }

  const text = Array.isArray(data)
    ? Buffer.concat(data).toString("utf8")
    : data instanceof ArrayBuffer
      ? Buffer.from(data).toString("utf8")
      : data.toString("utf8");

  return JSON.parse(text) as unknown;
}

function isUnknownEvent(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    typeof value.type === "string" &&
    value.type !== "room.join"
  );
}

export const roomRoutes: FastifyPluginAsync<RoomRoutesOptions> = async (
  app,
  options,
) => {
  const registry = options.registry ?? createRoomRegistry();
  const sockets = new Set<RoomSocket>();
  const presence = createRoomPresenceCoordinator({
    registry,
    eventWriter: options.eventWriter,
    heartbeatIntervalMs: options.heartbeatIntervalMs,
    disconnectGraceMs: options.disconnectGraceMs,
  });

  app.addHook("onClose", async () => {
    await presence.close();
    for (const socket of sockets) socket.terminate();
    sockets.clear();
  });

  app.get(
    "/rooms/socket",
    {
      websocket: true,
      preValidation: async (request, reply) => {
        if (
          !isAllowedRoomOrigin(request.headers.origin, options.allowedOrigins)
        ) {
          await reply.code(403).send({
            error: {
              code: "FORBIDDEN",
              message: "WebSocket origin is not allowed.",
              requestId: request.id,
            },
          });
        }
      },
    },
    (socket, request) => {
      sockets.add(socket);
      let phase: ConnectionPhase = "awaiting_join";
      let roomId: string | undefined;
      const completedCommands = new Map<string, string>();

      const authenticationDeadline = setTimeout(() => {
        if (phase !== "awaiting_join" && phase !== "joining") {
          return;
        }

        phase = "closed";
        sendRoomError(socket, {
          roomId,
          code: "UNAUTHORIZED",
          message: "Room authentication timed out.",
        });
        socket.close(CLOSE_UNAUTHORIZED, "Authentication timed out");
      }, options.authenticationTimeoutMs);

      const failConnection = (error: unknown) => {
        request.log.error({ err: error }, "Room WebSocket handler failed");
        sendRoomError(socket, {
          roomId,
          code: "INTERNAL_SERVER_ERROR",
          message: "The room connection could not be processed.",
        });
        socket.close(1011, "Room connection failed");
      };

      const handleMessage = async (data: RawData, isBinary: boolean) => {
        let decoded: unknown;

        try {
          decoded = decodeMessage(data, isBinary);
        } catch {
          sendRoomError(socket, {
            roomId,
            code: "VALIDATION_ERROR",
            message: "Room messages must be valid JSON text.",
          });
          return;
        }

        const parsed = roomClientCommandSchema.safeParse(decoded);

        if (!parsed.success) {
          sendRoomError(socket, {
            roomId,
            code: isUnknownEvent(decoded)
              ? "UNKNOWN_EVENT"
              : "VALIDATION_ERROR",
            message: isUnknownEvent(decoded)
              ? "Unknown room event type."
              : "Invalid room message.",
          });
          return;
        }

        const command = parsed.data;

        const completed = completedCommands.get(command.clientEventId);
        if (completed !== undefined) {
          socket.send(completed);
          return;
        }

        if (phase !== "awaiting_join") {
          sendRoomError(socket, {
            roomId: command.payload.sessionId,
            clientEventId: command.clientEventId,
            code: "VALIDATION_ERROR",
            message: "This connection has already attempted to join a room.",
          });
          return;
        }

        phase = "joining";
        const requestedRoomId = command.payload.sessionId;
        roomId = requestedRoomId;

        const authentication = await options.authenticateRoom({
          sessionId: requestedRoomId,
          credential: command.payload.credential,
        });

        if (socket.readyState !== WebSocket.OPEN) {
          return;
        }

        if (authentication.kind !== "authenticated") {
          phase = "closed";
          sendRoomError(socket, {
            roomId: requestedRoomId,
            clientEventId: command.clientEventId,
            code: "UNAUTHORIZED",
            message:
              authentication.kind === "timeout"
                ? "Room authentication timed out."
                : "Room authentication failed.",
          });
          socket.close(CLOSE_UNAUTHORIZED, "Authentication failed");
          return;
        }

        const access = await options.authorizeRoomJoin({
          sessionId: requestedRoomId,
          principal: authentication.principal,
        });

        if (socket.readyState !== WebSocket.OPEN) {
          return;
        }

        if (access.kind !== "authorized") {
          phase = "closed";
          sendRoomError(socket, {
            roomId: requestedRoomId,
            clientEventId: command.clientEventId,
            code:
              access.kind === "session_closed" ? "SESSION_CLOSED" : "FORBIDDEN",
            message:
              access.kind === "session_closed"
                ? "This interview session is closed."
                : "You do not have access to this room.",
          });
          socket.close(CLOSE_FORBIDDEN, "Room access denied");
          return;
        }

        const joinedPresence = presence.join({
          roomId: requestedRoomId,
          roster: access.state.participants,
          participant: access.participant,
          socket: socket as HeartbeatSocket,
        });
        const registration = joinedPresence.registration;

        if (registration.kind === "conflict") {
          phase = "closed";
          sendRoomError(socket, {
            roomId: requestedRoomId,
            clientEventId: command.clientEventId,
            code: "FORBIDDEN",
            message: "The participant slot is already occupied.",
          });
          socket.close(CLOSE_FORBIDDEN, "Participant conflict");
          return;
        }

        phase = "joined";
        clearTimeout(authenticationDeadline);
        const occurredAt = new Date().toISOString();
        const joinedEvent = roomJoinedEventSchema.parse({
          eventId: randomUUID(),
          roomId: requestedRoomId,
          schemaVersion: 1,
          actorParticipantId: access.participant.id,
          clientEventId: command.clientEventId,
          occurredAt,
          type: "room.joined",
          payload: {
            participant: access.participant,
            state: {
              session: access.state.session,
              problem: access.state.problem,
              presence: joinedPresence.presence,
            },
          },
        });

        const serialized = JSON.stringify(joinedEvent);
        completedCommands.set(command.clientEventId, serialized);
        socket.send(serialized);
        joinedPresence.announce((error) => {
          request.log.error({ err: error }, "Room event persistence failed");
        });
      };

      socket.on("message", (data, isBinary) => {
        void handleMessage(data, isBinary).catch(failConnection);
      });

      socket.once("close", () => {
        phase = "closed";
        clearTimeout(authenticationDeadline);
        sockets.delete(socket);
        presence.leave(socket as HeartbeatSocket, (error) => {
          request.log.error({ err: error }, "Room event persistence failed");
        });
      });

      socket.once("error", (error) => {
        request.log.warn({ err: error }, "Room WebSocket transport error");
      });
    },
  );
};
