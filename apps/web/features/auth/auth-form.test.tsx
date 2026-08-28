import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthForm } from "./auth-form";

const { refresh, replace, signInWithOAuth, signInWithPassword, signUp } =
  vi.hoisted(() => ({
    refresh: vi.fn(),
    replace: vi.fn(),
    signInWithOAuth: vi.fn(),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
  }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, replace }),
}));

vi.mock("../../lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signInWithOAuth, signInWithPassword, signUp },
  }),
}));

function renderAuthForm() {
  render(<AuthForm />);
}

function fillInput(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function openSignUp() {
  fireEvent.click(screen.getByRole("button", { name: "Create an account" }));
}

function fillValidSignUp() {
  fillInput("Display name", "Ada Lovelace");
  fillInput("Email", "ada@example.com");
  fillInput("Password", "secure-password");
  fillInput("Confirm password", "secure-password");
}

describe("AuthForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signInWithOAuth.mockResolvedValue({ error: null });
    signInWithPassword.mockResolvedValue({ error: null });
    signUp.mockResolvedValue({
      data: { session: { access_token: "access-token" }, user: {} },
      error: null,
    });
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
    expect(
      screen.getByRole("button", { name: "Continue with Google" }),
    ).toBeInTheDocument();
  });

  it("starts Google OAuth with the SyncSlate callback", async () => {
    renderAuthForm();

    fireEvent.click(
      screen.getByRole("button", { name: "Continue with Google" }),
    );

    await waitFor(() =>
      expect(signInWithOAuth).toHaveBeenCalledWith({
        provider: "google",
        options: {
          redirectTo: "http://localhost:3000/auth/callback",
        },
      }),
    );
    expect(
      screen.getByRole("button", { name: "Connecting to Google…" }),
    ).toBeDisabled();
    expect(screen.getByLabelText("Email")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Create an account" }),
    ).toBeDisabled();
  });

  it("keeps Google OAuth available in account-creation mode", () => {
    renderAuthForm();
    openSignUp();

    expect(
      screen.getByRole("button", { name: "Continue with Google" }),
    ).toBeInTheDocument();
  });

  it("shows a safe Google OAuth error and restores the controls", async () => {
    signInWithOAuth.mockResolvedValue({
      error: new Error("sensitive provider failure"),
    });
    renderAuthForm();

    fireEvent.click(
      screen.getByRole("button", { name: "Continue with Google" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to continue with Google. Please try again.",
    );
    expect(
      screen.queryByText("sensitive provider failure"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Continue with Google" }),
    ).toBeEnabled();
    expect(screen.getByLabelText("Email")).toBeEnabled();
  });

  it("handles an unexpected Google OAuth failure safely", async () => {
    signInWithOAuth.mockRejectedValue(new Error("sensitive client failure"));
    renderAuthForm();

    fireEvent.click(
      screen.getByRole("button", { name: "Continue with Google" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to continue with Google. Please try again.",
    );
    expect(
      screen.queryByText("sensitive client failure"),
    ).not.toBeInTheDocument();
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

  it("creates an account with display-name metadata and opens the dashboard", async () => {
    renderAuthForm();
    openSignUp();

    expect(
      screen.getByRole("heading", { name: "Create your account" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Display name")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm password")).toBeInTheDocument();

    fillValidSignUp();
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() =>
      expect(signUp).toHaveBeenCalledWith({
        email: "ada@example.com",
        password: "secure-password",
        options: {
          emailRedirectTo: "http://localhost:3000/auth/callback",
          data: { display_name: "Ada Lovelace" },
        },
      }),
    );
    expect(replace).toHaveBeenCalledWith("/dashboard");
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("asks the user to check their email when confirmation is required", async () => {
    signUp.mockResolvedValue({
      data: { session: null, user: { id: "user-id" } },
      error: null,
    });
    renderAuthForm();
    openSignUp();
    fillValidSignUp();

    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Check your email to confirm your account, then sign in.",
    );
    expect(replace).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows confirmation errors in sign-up mode", () => {
    renderAuthForm();
    openSignUp();
    fillInput("Display name", "Ada Lovelace");
    fillInput("Email", "ada@example.com");
    fillInput("Password", "secure-password");
    fillInput("Confirm password", "different-password");
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(screen.getByText("Passwords do not match")).toBeInTheDocument();
    expect(signUp).not.toHaveBeenCalled();
  });

  it.each([
    ["user_already_exists", "An account with this email already exists."],
    ["weak_password", "Choose a stronger password."],
    [
      "over_email_send_rate_limit",
      "Too many account creation attempts. Please try again later.",
    ],
    [
      "unknown_error",
      "Unable to create your account right now. Please try again.",
    ],
  ])("shows a safe sign-up message for %s", async (code, message) => {
    signUp.mockResolvedValue({
      data: { session: null, user: null },
      error: { code },
    });
    renderAuthForm();
    openSignUp();
    fillValidSignUp();

    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(replace).not.toHaveBeenCalled();
  });

  it("handles an unexpected sign-up failure safely", async () => {
    signUp.mockRejectedValue(new Error("sensitive failure"));
    renderAuthForm();
    openSignUp();
    fillValidSignUp();

    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to create your account right now. Please try again.",
    );
    expect(screen.queryByText("sensitive failure")).not.toBeInTheDocument();
  });

  it("disables account-creation controls while signing up", async () => {
    let finishSignUp:
      | ((value: {
          data: { session: null; user: { id: string } };
          error: null;
        }) => void)
      | undefined;
    signUp.mockImplementation(
      () =>
        new Promise<{
          data: { session: null; user: { id: string } };
          error: null;
        }>((resolve) => {
          finishSignUp = resolve;
        }),
    );
    renderAuthForm();
    openSignUp();
    fillValidSignUp();

    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(
      await screen.findByRole("button", { name: "Creating account…" }),
    ).toBeDisabled();
    expect(screen.getByLabelText("Display name")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled();

    finishSignUp?.({
      data: { session: null, user: { id: "user-id" } },
      error: null,
    });

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Create account" }),
      ).toBeEnabled(),
    );
  });

  it("disables controls and announces progress while submitting", async () => {
    let finishSubmission: ((value: { error: null }) => void) | undefined;
    signInWithPassword.mockImplementation(
      () =>
        new Promise<{ error: null }>((resolve) => {
          finishSubmission = resolve;
        }),
    );

    render(<AuthForm />);
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
