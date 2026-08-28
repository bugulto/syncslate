import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SignOutButton } from "./sign-out-button";

const { signOutAction } = vi.hoisted(() => ({
  signOutAction: vi.fn(),
}));

vi.mock("./sign-out.action", () => ({ signOutAction }));

describe("SignOutButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signOutAction.mockResolvedValue({ error: null });
  });

  it("submits the sign-out action", async () => {
    render(<SignOutButton />);

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(signOutAction).toHaveBeenCalledOnce());
  });

  it("disables the button while sign-out is pending", async () => {
    let finishSignOut: ((state: { error: null }) => void) | undefined;

    signOutAction.mockReturnValue(
      new Promise((resolve) => {
        finishSignOut = resolve;
      }),
    );

    render(<SignOutButton />);
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    const pendingButton = await screen.findByRole("button", {
      name: "Signing out…",
    });

    expect(pendingButton).toBeDisabled();

    await act(async () => {
      finishSignOut?.({ error: null });
    });
  });

  it("announces a safe sign-out error", async () => {
    signOutAction.mockResolvedValue({
      error: "Unable to sign out. Please try again.",
    });

    render(<SignOutButton />);
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to sign out. Please try again.",
    );
  });
});
