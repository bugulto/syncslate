import { EventEmitter } from "node:events";

import { describe, expect, it, vi } from "vitest";

import { createRoomHeartbeat, type HeartbeatSocket } from "./room-heartbeat.js";

function createSocket() {
  const emitter = new EventEmitter();
  const socket = {
    readyState: 1,
    send: vi.fn(),
    close: vi.fn(),
    terminate: vi.fn(),
    ping: vi.fn(),
    on: (event: "pong", listener: () => void) => {
      emitter.on(event, listener);
    },
    off: (event: "pong", listener: () => void) => {
      emitter.off(event, listener);
    },
    pong: () => emitter.emit("pong"),
  };

  return socket;
}

describe("room heartbeat", () => {
  it("terminates sockets that miss a heartbeat", async () => {
    vi.useFakeTimers();
    try {
      const socket = createSocket();
      const heartbeat = createRoomHeartbeat({ intervalMs: 1_000 });
      heartbeat.track(socket satisfies HeartbeatSocket);

      await vi.advanceTimersByTimeAsync(1_000);
      expect(socket.ping).toHaveBeenCalledOnce();
      expect(socket.terminate).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1_000);
      expect(socket.terminate).toHaveBeenCalledOnce();
      heartbeat.stop();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps responsive sockets alive and removes listeners on stop", async () => {
    vi.useFakeTimers();
    try {
      const socket = createSocket();
      const heartbeat = createRoomHeartbeat({ intervalMs: 1_000 });
      heartbeat.track(socket satisfies HeartbeatSocket);

      await vi.advanceTimersByTimeAsync(1_000);
      socket.pong();
      await vi.advanceTimersByTimeAsync(1_000);

      expect(socket.ping).toHaveBeenCalledTimes(2);
      expect(socket.terminate).not.toHaveBeenCalled();
      heartbeat.stop();
    } finally {
      vi.useRealTimers();
    }
  });
});
