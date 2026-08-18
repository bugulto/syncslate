import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthForm } from "./auth-form";

const { refresh, replace, signInWithPassword } = vi.hoisted(() => ({
  refresh: vi.fn(),
  replace: vi.fn(),
  signInWithPassword: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, replace }),
}));

vi.mock("../../lib/supabase/client", () => ({
  createClient: () => ({ auth: { signInWithPassword } }),
}));

function renderAuthForm() {
  const onSignUp = vi.fn();

  render(<AuthForm onSignUp={onSignUp} />);

  return { onSignUp };
}

function fillInput(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe("AuthForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signInWithPassword.mockResolvedValue({ error: null });
  });

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
    renderAuthForm();

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(screen.getByText("Email is required")).toBeInTheDocument();
    expect(screen.getByText("Password is required")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("signs in with normalized data and opens the dashboard", async () => {
    renderAuthForm();

    fillInput("Email", "  ada@example.com  ");
    fillInput("Password", "secure-password");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() =>
      expect(signInWithPassword).toHaveBeenCalledWith({
        email: "ada@example.com",
        password: "secure-password",
      }),
    );
    expect(replace).toHaveBeenCalledWith("/dashboard");
    expect(refresh).toHaveBeenCalledOnce();
  });

  it.each([
    ["invalid_credentials", "Invalid email or password."],
    ["email_not_confirmed", "Confirm your email before signing in."],
    [
      "over_request_rate_limit",
      "Too many sign-in attempts. Please try again later.",
    ],
    ["unknown_error", "Unable to sign in right now. Please try again."],
  ])("shows a safe message for %s", async (code, message) => {
    signInWithPassword.mockResolvedValue({ error: { code } });
    renderAuthForm();

    fillInput("Email", "ada@example.com");
    fillInput("Password", "secure-password");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(replace).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("handles an unexpected client failure without exposing details", async () => {
    signInWithPassword.mockRejectedValue(new Error("sensitive failure"));
    renderAuthForm();

    fillInput("Email", "ada@example.com");
    fillInput("Password", "secure-password");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to sign in right now. Please try again.",
    );
    expect(screen.queryByText("sensitive failure")).not.toBeInTheDocument();
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
    let finishSubmission: ((value: { error: null }) => void) | undefined;
    signInWithPassword.mockImplementation(
      () =>
        new Promise<{ error: null }>((resolve) => {
          finishSubmission = resolve;
        }),
    );

    render(<AuthForm onSignUp={vi.fn()} />);
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

    finishSubmission?.({ error: null });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled(),
    );
  });
});
