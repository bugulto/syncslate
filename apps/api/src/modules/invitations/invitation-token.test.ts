import { describe, expect, it } from "vitest";

import {
  generateInvitationToken,
  hashInvitationToken,
} from "./invitation-token.js";

describe("invitation token utilities", () => {
  it("generates unique URL-safe tokens with 256 bits of randomness", () => {
    const firstToken = generateInvitationToken();
    const secondToken = generateInvitationToken();

    expect(firstToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(secondToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(firstToken).not.toBe(secondToken);
  });

  it("hashes deterministically for the same token and pepper", () => {
    const token = "A".repeat(43);
    const pepper = "test-invitation-token-pepper-12345";

    expect(hashInvitationToken(token, pepper)).toBe(
      hashInvitationToken(token, pepper),
    );
    expect(hashInvitationToken(token, pepper)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("produces different hashes for different tokens or peppers", () => {
    const token = "A".repeat(43);
    const pepper = "test-invitation-token-pepper-12345";
    const hash = hashInvitationToken(token, pepper);

    expect(hashInvitationToken("B".repeat(43), pepper)).not.toBe(hash);
    expect(
      hashInvitationToken(token, "another-invitation-token-pepper-12"),
    ).not.toBe(hash);
  });
});
