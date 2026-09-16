import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import JoinPage from "./page";

const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn(),
}));

vi.mock("next/navigation", () => ({ notFound }));
vi.mock("../../../features/invitations/candidate-waiting-room", () => ({
  CandidateWaitingRoom: ({ inviteToken }: { inviteToken: string }) => (
    <div>Waiting room for {inviteToken}</div>
  ),
}));

const inviteToken = "A".repeat(43);

describe("JoinPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notFound.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });
  });

  it("renders the public waiting room for a valid invitation token", async () => {
    render(
      await JoinPage({
        params: Promise.resolve({ inviteToken }),
      }),
    );

    expect(
      screen.getByText(`Waiting room for ${inviteToken}`),
    ).toBeInTheDocument();
  });

  it("returns not found for a malformed invitation token", async () => {
    await expect(
      JoinPage({
        params: Promise.resolve({ inviteToken: "invalid" }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledOnce();
  });
});
