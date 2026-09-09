import { describe, expect, it } from "vitest";

import { isUserAuthPrincipal, type AuthPrincipal } from "./auth-principal.js";

describe("isUserAuthPrincipal", () => {
  it("accepts authenticated application users", () => {
    expect(
      isUserAuthPrincipal({
        kind: "user",
        userId: "550e8400-e29b-41d4-a716-446655440030",
      }),
    ).toBe(true);
  });

  it("rejects room-scoped guests and missing principals", () => {
    const guest = {
      kind: "guest",
      participantId: "550e8400-e29b-41d4-a716-446655440031",
      sessionId: "550e8400-e29b-41d4-a716-446655440032",
      role: "candidate",
    } satisfies AuthPrincipal;

    expect(isUserAuthPrincipal(guest)).toBe(false);
    expect(isUserAuthPrincipal(null)).toBe(false);
  });
});
