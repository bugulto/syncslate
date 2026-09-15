import { randomUUID } from "node:crypto";

import {
  participantDisconnectedEventSchema,
  participantReconnectedEventSchema,
  presenceChangedEventSchema,
  type Participant,
  type PresenceList,
} from "@syncslate/contracts";
import { WebSocket } from "ws";

import type { RoomEventWriter } from "./room-event-writer.js";
import { createRoomHeartbeat, type HeartbeatSocket } from "./room-heartbeat.js";
import type {
  RegisterRoomSocketResult,
  RoomRegistry,
  RoomSocket,
} from "./room-registry.js";

type PendingDisconnect = { timer: NodeJS.Timeout; lastSeenAt: Date };

export type RoomPresenceCoordinator = ReturnType<
  typeof createRoomPresenceCoordinator
>;

export function createRoomPresenceCoordinator(options: {
  registry: RoomRegistry;
  eventWriter: RoomEventWriter;
  heartbeatIntervalMs: number;
  disconnectGraceMs: number;
}) {
  const heartbeat = createRoomHeartbeat({
    intervalMs: options.heartbeatIntervalMs,
  });
  const rosters = new Map<string, Map<string, Participant>>();
  const lastSeen = new Map<string, string>();
  const pending = new Map<string, PendingDisconnect>();
  let closing = false;
  const key = (roomId: string, participantId: string) =>
    `${roomId}:${participantId}`;

  function broadcast(roomId: string, event: unknown, exclude?: RoomSocket) {
    const message = JSON.stringify(event);
    for (const socket of options.registry.getRoomSockets(roomId)) {
      if (socket !== exclude && socket.readyState === WebSocket.OPEN) {
        socket.send(message);
      }
    }
  }

  function presence(roomId: string, now: string): PresenceList {
    return [...(rosters.get(roomId)?.values() ?? [])].map((participant) => {
      const participantKey = key(roomId, participant.id);
      return {
        participant,
        status:
          options.registry.getParticipantSocketCount(roomId, participant.id) >
            0 || pending.has(participantKey)
            ? "connected"
            : "disconnected",
        lastSeenAt: lastSeen.get(participantKey) ?? now,
      };
    });
  }

  function broadcastPresence(
    roomId: string,
    occurredAt: string,
    actorParticipantId: string,
    exclude?: RoomSocket,
  ) {
    broadcast(
      roomId,
      presenceChangedEventSchema.parse({
        eventId: randomUUID(),
        roomId,
        schemaVersion: 1,
        actorParticipantId,
        occurredAt,
        type: "presence.changed",
        payload: { presence: presence(roomId, occurredAt) },
      }),
      exclude,
    );
  }

  function cleanRoom(roomId: string) {
    if (
      options.registry.getRoomSockets(roomId).length === 0 &&
      ![...pending.keys()].some((value) => value.startsWith(`${roomId}:`))
    ) {
      rosters.delete(roomId);
      for (const value of lastSeen.keys()) {
        if (value.startsWith(`${roomId}:`)) lastSeen.delete(value);
      }
    }
  }

  return {
    join(input: {
      roomId: string;
      roster: Participant[];
      participant: Participant;
      socket: HeartbeatSocket;
    }): {
      registration: RegisterRoomSocketResult;
      presence: PresenceList;
      announce(onError: (error: unknown) => void): void;
    } {
      const roster =
        rosters.get(input.roomId) ?? new Map<string, Participant>();
      for (const participant of input.roster)
        roster.set(participant.id, participant);
      rosters.set(input.roomId, roster);

      const participantKey = key(input.roomId, input.participant.id);
      const interruptedDisconnect = pending.get(participantKey);
      if (interruptedDisconnect !== undefined) {
        clearTimeout(interruptedDisconnect.timer);
        pending.delete(participantKey);
      }
      const registration = options.registry.register({
        sessionId: input.roomId,
        participant: input.participant,
        socket: input.socket,
      });
      const occurredAtDate = new Date();
      const occurredAt = occurredAtDate.toISOString();
      if (registration.kind !== "conflict") {
        heartbeat.track(input.socket);
        lastSeen.set(participantKey, occurredAt);
      }

      return {
        registration,
        presence: presence(input.roomId, occurredAt),
        announce(onError) {
          if (
            registration.kind !== "participant_connected" ||
            interruptedDisconnect !== undefined
          )
            return;
          broadcastPresence(
            input.roomId,
            occurredAt,
            input.participant.id,
            input.socket,
          );
          void options.eventWriter
            .recordParticipantConnected({
              sessionId: input.roomId,
              participant: input.participant,
              occurredAt: occurredAtDate,
            })
            .then((event) => {
              if (event.type === "participant.reconnected") {
                broadcast(
                  input.roomId,
                  participantReconnectedEventSchema.parse({
                    eventId: event.id,
                    roomId: input.roomId,
                    schemaVersion: 1,
                    actorParticipantId: input.participant.id,
                    sequence: event.sequence,
                    occurredAt,
                    type: "participant.reconnected",
                    payload: {
                      participantId: input.participant.id,
                      reconnectedAt: occurredAt,
                    },
                  }),
                  input.socket,
                );
              }
            })
            .catch(onError);
        },
      };
    },

    leave(socket: HeartbeatSocket, onError: (error: unknown) => void) {
      heartbeat.untrack(socket);
      const result = options.registry.unregister(socket);
      if (closing || result.kind !== "participant_disconnected") return;
      const participantKey = key(result.sessionId, result.participant.id);
      const lastSeenAt = new Date();
      lastSeen.set(participantKey, lastSeenAt.toISOString());
      const timer = setTimeout(() => {
        if (pending.get(participantKey)?.timer !== timer) return;
        pending.delete(participantKey);
        if (
          closing ||
          options.registry.getParticipantSocketCount(
            result.sessionId,
            result.participant.id,
          ) > 0
        )
          return;
        void options.eventWriter
          .recordParticipantDisconnected({
            sessionId: result.sessionId,
            participantId: result.participant.id,
            lastSeenAt,
          })
          .then((event) => {
            const occurredAt = lastSeenAt.toISOString();
            broadcast(
              result.sessionId,
              participantDisconnectedEventSchema.parse({
                eventId: event.id,
                roomId: result.sessionId,
                schemaVersion: 1,
                actorParticipantId: result.participant.id,
                sequence: event.sequence,
                occurredAt,
                type: "participant.disconnected",
                payload: {
                  participantId: result.participant.id,
                  lastSeenAt: occurredAt,
                },
              }),
            );
            broadcastPresence(
              result.sessionId,
              occurredAt,
              result.participant.id,
            );
            cleanRoom(result.sessionId);
          })
          .catch(onError);
      }, options.disconnectGraceMs);
      pending.set(participantKey, { timer, lastSeenAt });
    },

    async close() {
      closing = true;
      heartbeat.stop();
      for (const value of pending.values()) clearTimeout(value.timer);
      pending.clear();
      for (const socket of options.registry.drain()) socket.terminate();
      rosters.clear();
      lastSeen.clear();
      await options.eventWriter.flush();
    },
  };
}
