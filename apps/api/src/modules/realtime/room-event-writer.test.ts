import type { AppendSessionEventInput } from "@syncslate/database";
import { describe, expect, it, vi } from "vitest";

import { createRoomEventWriter } from "./room-event-writer.js";

const sessionId = "30000000-0000-4000-8000-000000000001";
const participant = {
  id: "50000000-0000-4000-8000-000000000001",
  displayName: "Candidate",
  role: "candidate" as const,
};
const occurredAt = new Date("2026-09-26T08:00:00.000Z");

function persistedEvent(input: AppendSessionEventInput, sequence = 1) {
  return {
    id: `70000000-0000-4000-8000-${sequence.toString().padStart(12, "0")}`,
    ...input,
    sequence,
    occurredAt: input.occurredAt.toISOString(),
    createdAt: input.occurredAt.toISOString(),
  };
}

describe("room event writer", () => {
  it("records the first connection as participant joined", async () => {
    const appendSessionEvent = vi.fn(async (input: AppendSessionEventInput) =>
      persistedEvent(input),
    );
    const writer = createRoomEventWriter({
      appendSessionEvent,
      hasSessionEvent: vi.fn(async () => false),
    });

    const event = await writer.recordParticipantConnected({
      sessionId,
      participant,
      occurredAt,
    });

    expect(event).toMatchObject({
      type: "participant.joined",
      payload: { participant },
    });
  });

  it("records later connections as participant reconnected", async () => {
    const appendSessionEvent = vi.fn(async (input: AppendSessionEventInput) =>
      persistedEvent(input),
    );
    const writer = createRoomEventWriter({
      appendSessionEvent,
      hasSessionEvent: vi.fn(async () => true),
    });

    const event = await writer.recordParticipantConnected({
      sessionId,
      participant,
      occurredAt,
    });

    expect(event).toMatchObject({
      type: "participant.reconnected",
      payload: {
        participantId: participant.id,
        reconnectedAt: occurredAt.toISOString(),
      },
    });
  });

  it("serializes writes per session and flushes pending work", async () => {
    let releaseFirst: (() => void) | undefined;
    const firstBlocked = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const order: string[] = [];
    const appendSessionEvent = vi.fn(async (input: AppendSessionEventInput) => {
      order.push(`start:${input.type}`);
      if (input.type === "participant.joined") {
        await firstBlocked;
      }
      order.push(`end:${input.type}`);
      return persistedEvent(input, order.length);
    });
    const writer = createRoomEventWriter({
      appendSessionEvent,
      hasSessionEvent: vi.fn(async () => false),
    });
    const connected = writer.recordParticipantConnected({
      sessionId,
      participant,
      occurredAt,
    });
    const disconnected = writer.recordParticipantDisconnected({
      sessionId,
      participantId: participant.id,
      lastSeenAt: occurredAt,
    });

    await vi.waitFor(() => {
      expect(order).toEqual(["start:participant.joined"]);
    });
    releaseFirst?.();
    await writer.flush();
    await Promise.all([connected, disconnected]);

    expect(order).toEqual([
      "start:participant.joined",
      "end:participant.joined",
      "start:participant.disconnected",
      "end:participant.disconnected",
    ]);
  });

  it("rejects missing database records", async () => {
    const writer = createRoomEventWriter({
      appendSessionEvent: vi.fn(async () => null),
      hasSessionEvent: vi.fn(async () => false),
    });

    await expect(
      writer.recordParticipantConnected({
        sessionId,
        participant,
        occurredAt,
      }),
    ).rejects.toThrow("Room event could not be persisted");
  });
});
