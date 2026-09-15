import type { RoomSocket } from "./room-registry.js";

export type HeartbeatSocket = RoomSocket & {
  ping(): void;
  on(event: "pong", listener: () => void): void;
  off(event: "pong", listener: () => void): void;
};

export type RoomHeartbeat = {
  track(socket: HeartbeatSocket): void;
  untrack(socket: HeartbeatSocket): void;
  stop(): void;
};

export function createRoomHeartbeat(options: {
  intervalMs: number;
}): RoomHeartbeat {
  const tracked = new Map<
    HeartbeatSocket,
    { alive: boolean; onPong: () => void }
  >();

  const interval = setInterval(() => {
    for (const [socket, state] of tracked) {
      if (!state.alive) {
        tracked.delete(socket);
        socket.off("pong", state.onPong);
        socket.terminate();
        continue;
      }

      state.alive = false;
      socket.ping();
    }
  }, options.intervalMs);

  return {
    track(socket) {
      if (tracked.has(socket)) {
        return;
      }

      const state = {
        alive: true,
        onPong: () => {
          state.alive = true;
        },
      };
      tracked.set(socket, state);
      socket.on("pong", state.onPong);
    },

    untrack(socket) {
      const state = tracked.get(socket);
      if (state === undefined) {
        return;
      }

      tracked.delete(socket);
      socket.off("pong", state.onPong);
    },

    stop() {
      clearInterval(interval);
      for (const [socket, state] of tracked) {
        socket.off("pong", state.onPong);
      }
      tracked.clear();
    },
  };
}
