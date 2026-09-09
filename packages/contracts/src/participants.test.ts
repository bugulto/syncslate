import { describe, expect, it } from "vitest";

import {
  participantPresenceSchema,
  participantSchema,
  presenceListSchema,
} from "./participants.js";

const interviewer = {
  id: "550e8400-e29b-41d4-a716-446655440010",
  displayName: "Ada Lovelace",
  role: "interviewer" as const,
};

const candidate = {
  id: "550e8400-e29b-41d4-a716-446655440011",
  displayName: "Grace Hopper",
  role: "candidate" as const,
};

describe("participant contracts", () => {
  it("exposes room identity without application user IDs", () => {
    expect(participantSchema.parse(candidate)).toEqual(candidate);
    expect(
      participantSchema.safeParse({ ...candidate, userId: interviewer.id })
        .success,
    ).toBe(false);
  });

  it("validates presence and normalizes display names", () => {
    expect(
      participantPresenceSchema.parse({
        participant: { ...candidate, displayName: "  Grace Hopper  " },
        status: "connected",
        lastSeenAt: "2026-09-21T09:00:00.000Z",
      }),
    ).toEqual({
      participant: candidate,
      status: "connected",
      lastSeenAt: "2026-09-21T09:00:00.000Z",
    });
  });

  it("allows one participant per role and rejects duplicates", () => {
    const presence = [interviewer, candidate].map((participant) => ({
      participant,
      status: "connected" as const,
      lastSeenAt: "2026-09-21T09:00:00.000Z",
    }));

    expect(presenceListSchema.parse(presence)).toEqual(presence);
    expect(
      presenceListSchema.safeParse([presence[0], presence[0]]).success,
    ).toBe(false);
    expect(
      presenceListSchema.safeParse([
        {
          participant: candidate,
          status: "connected",
          lastSeenAt: "2026-09-21T09:00:00.000Z",
        },
        {
          participant: {
            ...candidate,
            id: "550e8400-e29b-41d4-a716-446655440012",
          },
          status: "connected",
          lastSeenAt: "2026-09-21T09:00:00.000Z",
        },
      ]).success,
    ).toBe(false);
  });
});
