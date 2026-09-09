import { describe, expect, it } from "vitest";

import {
  roomClientCommandSchema,
  roomEventEnvelopeSchema,
  roomStateSchema,
} from "./rooms.js";

const sessionId = "550e8400-e29b-41d4-a716-446655440020";
const participantId = "550e8400-e29b-41d4-a716-446655440021";
const eventId = "550e8400-e29b-41d4-a716-446655440022";
const clientEventId = "550e8400-e29b-41d4-a716-446655440023";
const occurredAt = "2026-09-21T09:00:00.000Z";

const participant = {
  id: participantId,
  displayName: "Grace Hopper",
  role: "candidate" as const,
};

const session = {
  id: sessionId,
  title: "Backend interview",
  status: "waiting" as const,
  language: "typescript" as const,
  editingPolicy: "candidate_only" as const,
  durationSeconds: 2700,
  startedAt: null,
};

const problem = {
  id: "550e8400-e29b-41d4-a716-446655440024",
  title: "Two Sum",
  difficulty: "easy" as const,
  tags: ["arrays"],
  descriptionMarkdown: "Find two values.",
  constraintsMarkdown: null,
  examples: [{ input: "[2, 7]", output: "[0, 1]", explanation: null }],
};

const state = {
  session,
  problem,
  presence: [
    {
      participant,
      status: "connected" as const,
      lastSeenAt: occurredAt,
    },
  ],
};

const baseEvent = {
  eventId,
  roomId: sessionId,
  schemaVersion: 1 as const,
  actorParticipantId: participantId,
  occurredAt,
};

describe("room state contracts", () => {
  it("accepts candidate-safe state", () => {
    expect(roomStateSchema.parse(state)).toEqual(state);
  });

  it("rejects interviewer notes and starter code", () => {
    expect(
      roomStateSchema.safeParse({
        ...state,
        problem: {
          ...problem,
          interviewerNotesMarkdown: "Expected solution",
          starterCode: [{ language: "typescript", code: "secret" }],
        },
      }).success,
    ).toBe(false);
  });
});

describe("room client commands", () => {
  it("accepts a minimal room join command", () => {
    const command = {
      type: "room.join" as const,
      clientEventId,
      payload: { sessionId },
    };

    expect(roomClientCommandSchema.parse(command)).toEqual(command);
  });

  it("rejects client-supplied authoritative fields", () => {
    expect(
      roomClientCommandSchema.safeParse({
        type: "room.join",
        clientEventId,
        eventId,
        occurredAt,
        actorParticipantId: participantId,
        payload: { sessionId },
      }).success,
    ).toBe(false);
  });
});

describe("server room events", () => {
  it.each([
    ["room.joined", { participant, state }],
    ["room.state", { state }],
    ["room.error", { code: "VALIDATION_ERROR", message: "Invalid event." }],
    ["presence.changed", { presence: state.presence }],
    ["participant.disconnected", { participantId, lastSeenAt: occurredAt }],
    ["participant.reconnected", { participantId, reconnectedAt: occurredAt }],
    ["session.started", { session: { ...session, status: "active" } }],
  ] as const)("accepts a valid %s event", (type, payload) => {
    expect(
      roomEventEnvelopeSchema.safeParse({ ...baseEvent, type, payload })
        .success,
    ).toBe(true);
  });

  it("rejects unknown versions, events, and mismatched payloads", () => {
    expect(
      roomEventEnvelopeSchema.safeParse({
        ...baseEvent,
        schemaVersion: 2,
        type: "room.state",
        payload: { state },
      }).success,
    ).toBe(false);
    expect(
      roomEventEnvelopeSchema.safeParse({
        ...baseEvent,
        type: "timer.tick",
        payload: {},
      }).success,
    ).toBe(false);
    expect(
      roomEventEnvelopeSchema.safeParse({
        ...baseEvent,
        type: "participant.disconnected",
        payload: { session: state.session },
      }).success,
    ).toBe(false);
  });
});
