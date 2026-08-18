import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AuthForm } from "./auth-form";

function renderAuthForm() {
  const onSignIn = vi.fn();
  const onSignUp = vi.fn();

  render(<AuthForm onSignIn={onSignIn} onSignUp={onSignUp} />);

  return { onSignIn, onSignUp };
}

function fillInput(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe("AuthForm", () => {
  it("starts in sign-in mode", () => {
    renderAuthForm();

    expect(
      screen.getByRole("heading", { name: "Sign in to SyncSlate" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "autocomplete",
      "current-password",
    );
    expect(screen.queryByLabelText("Display name")).not.toBeInTheDocument();
  });

  it("shows field errors and does not submit invalid sign-in data", () => {
    const { onSignIn } = renderAuthForm();

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(screen.getByText("Email is required")).toBeInTheDocument();
    expect(screen.getByText("Password is required")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(onSignIn).not.toHaveBeenCalled();
  });

  it("submits normalized sign-in data", async () => {
    const { onSignIn } = renderAuthForm();

    fillInput("Email", "  ada@example.com  ");
    fillInput("Password", "secure-password");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() =>
      expect(onSignIn).toHaveBeenCalledWith({
        email: "ada@example.com",
        password: "secure-password",
      }),
    );
  });

  it("switches to account creation and submits registration data", async () => {
    const { onSignUp } = renderAuthForm();

    fireEvent.click(screen.getByRole("button", { name: "Create an account" }));

    expect(
      screen.getByRole("heading", { name: "Create your account" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Display name")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm password")).toBeInTheDocument();

    fillInput("Display name", "Ada Lovelace");
    fillInput("Email", "ada@example.com");
    fillInput("Password", "secure-password");
    fillInput("Confirm password", "secure-password");
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() =>
      expect(onSignUp).toHaveBeenCalledWith({
        displayName: "Ada Lovelace",
        email: "ada@example.com",
        password: "secure-password",
        confirmPassword: "secure-password",
      }),
    );
  });

  it("shows confirmation errors in sign-up mode", () => {
    const { onSignUp } = renderAuthForm();

    fireEvent.click(screen.getByRole("button", { name: "Create an account" }));
    fillInput("Display name", "Ada Lovelace");
    fillInput("Email", "ada@example.com");
    fillInput("Password", "secure-password");
    fillInput("Confirm password", "different-password");
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(screen.getByText("Passwords do not match")).toBeInTheDocument();
    expect(onSignUp).not.toHaveBeenCalled();
  });

  it("disables controls and announces progress while submitting", async () => {
    let finishSubmission: (() => void) | undefined;
    const onSignIn = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishSubmission = resolve;
        }),
    );

    render(<AuthForm onSignIn={onSignIn} onSignUp={vi.fn()} />);
    fillInput("Email", "ada@example.com");
    fillInput("Password", "secure-password");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByRole("button", { name: "Signing in…" }),
    ).toBeDisabled();
    expect(screen.getByLabelText("Email")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Create an account" }),
    ).toBeDisabled();

    finishSubmission?.();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled(),
    );
  });
});
