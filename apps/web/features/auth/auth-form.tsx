"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "../../lib/supabase/client";

import {
  signInSchema,
  signUpSchema,
  type SignInInput,
  type SignUpInput,
} from "./auth.schema";

type AuthMode = "sign-in" | "sign-up";
type FieldErrors = Record<string, string>;

export type AuthFormProps = {
  initialError?: string;
};

const defaultSignInError = "Unable to sign in right now. Please try again.";
const defaultSignUpError =
  "Unable to create your account right now. Please try again.";
const defaultGoogleError = "Unable to continue with Google. Please try again.";

function getSignInErrorMessage(error: { code: string | undefined }) {
  switch (error.code) {
    case "invalid_credentials":
      return "Invalid email or password.";
    case "email_not_confirmed":
      return "Confirm your email before signing in.";
    case "over_request_rate_limit":
      return "Too many sign-in attempts. Please try again later.";
    default:
      return defaultSignInError;
  }
}

function getSignUpErrorMessage(error: { code: string | undefined }) {
  switch (error.code) {
    case "email_exists":
    case "user_already_exists":
      return "An account with this email already exists.";
    case "weak_password":
      return "Choose a stronger password.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Too many account creation attempts. Please try again later.";
    case "signup_disabled":
      return "Account creation is currently unavailable.";
    default:
      return defaultSignUpError;
  }
}

function getFieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  return issues.reduce<FieldErrors>((errors, issue) => {
    const field = issue.path[0];

    if (typeof field === "string" && errors[field] === undefined) {
      errors[field] = issue.message;
    }

    return errors;
  }, {});
}

export function AuthForm({ initialError }: AuthFormProps = {}) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(
    initialError ?? null,
  );
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

  const isSignUp = mode === "sign-up";
  const isBusy = isSubmitting || isGoogleSubmitting;

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setFieldErrors({});
    setFormError(null);
    setFormMessage(null);
  }

  async function signUp(input: SignUpInput) {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            display_name: input.displayName,
          },
        },
      });

      if (error) {
        setFormError(getSignUpErrorMessage(error));
        return;
      }

      if (data.session) {
        router.replace("/dashboard");
        router.refresh();
        return;
      }

      if (data.user) {
        setFormMessage(
          "Check your email to confirm your account, then sign in.",
        );
        return;
      }

      setFormError(defaultSignUpError);
    } catch {
      setFormError(defaultSignUpError);
    }
  }

  async function signIn(input: SignInInput) {
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword(input);

      if (error) {
        setFormError(getSignInErrorMessage(error));
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch {
      setFormError(defaultSignInError);
    }
  }

  async function signInWithGoogle() {
    setFieldErrors({});
    setFormError(null);
    setFormMessage(null);
    setIsGoogleSubmitting(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setFormError(defaultGoogleError);
        setIsGoogleSubmitting(false);
      }
    } catch {
      setFormError(defaultGoogleError);
      setIsGoogleSubmitting(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const input = {
      email: formData.get("email"),
      password: formData.get("password"),
      ...(isSignUp
        ? {
            displayName: formData.get("displayName"),
            confirmPassword: formData.get("confirmPassword"),
          }
        : {}),
    };
    const result = (isSignUp ? signUpSchema : signInSchema).safeParse(input);

    if (!result.success) {
      setFieldErrors(getFieldErrors(result.error.issues));
      setFormError(null);
      setFormMessage(null);
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setFormMessage(null);
    setIsSubmitting(true);

    try {
      if (isSignUp) {
        await signUp(result.data as SignUpInput);
      } else {
        await signIn(result.data as SignInInput);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function fieldError(name: string) {
    const message = fieldErrors[name];

    if (!message) {
      return null;
    }

    return (
      <p id={`${name}-error`} className="mt-1 text-sm text-red-300">
        {message}
      </p>
    );
  }

  const inputClassName =
    "mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <section
      aria-labelledby="auth-form-title"
      className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl"
    >
      <h1 id="auth-form-title" className="text-2xl font-semibold text-white">
        {isSignUp ? "Create your account" : "Sign in to SyncSlate"}
      </h1>
      <p className="mt-2 text-sm text-slate-400">
        {isSignUp
          ? "Create an interviewer account to start running sessions."
          : "Continue to your interviewer dashboard."}
      </p>

      <button
        type="button"
        className="mt-6 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 font-semibold text-slate-100 transition hover:border-slate-500 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-wait disabled:opacity-60"
        disabled={isBusy}
        onClick={signInWithGoogle}
      >
        {isGoogleSubmitting ? "Connecting to Google…" : "Continue with Google"}
      </button>

      <div aria-hidden="true" className="mt-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-slate-700" />
        <span className="text-xs font-medium tracking-wider text-slate-500 uppercase">
          Or continue with email
        </span>
        <span className="h-px flex-1 bg-slate-700" />
      </div>

      <form
        key={mode}
        className="mt-6 space-y-4"
        noValidate
        onSubmit={handleSubmit}
      >
        {isSignUp ? (
          <div>
            <label htmlFor="displayName" className="text-sm text-slate-200">
              Display name
            </label>
            <input
              id="displayName"
              name="displayName"
              type="text"
              autoComplete="name"
              minLength={3}
              maxLength={20}
              disabled={isBusy}
              aria-invalid={Boolean(fieldErrors.displayName)}
              aria-describedby={
                fieldErrors.displayName ? "displayName-error" : undefined
              }
              className={inputClassName}
            />
            {fieldError("displayName")}
          </div>
        ) : null}

        <div>
          <label htmlFor="email" className="text-sm text-slate-200">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            disabled={isBusy}
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? "email-error" : undefined}
            className={inputClassName}
          />
          {fieldError("email")}
        </div>

        <div>
          <label htmlFor="password" className="text-sm text-slate-200">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={isSignUp ? "new-password" : "current-password"}
            disabled={isBusy}
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={
              fieldErrors.password ? "password-error" : undefined
            }
            className={inputClassName}
          />
          {fieldError("password")}
        </div>

        {isSignUp ? (
          <div>
            <label htmlFor="confirmPassword" className="text-sm text-slate-200">
              Confirm password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              disabled={isBusy}
              aria-invalid={Boolean(fieldErrors.confirmPassword)}
              aria-describedby={
                fieldErrors.confirmPassword
                  ? "confirmPassword-error"
                  : undefined
              }
              className={inputClassName}
            />
            {fieldError("confirmPassword")}
          </div>
        ) : null}

        {formError ? (
          <p
            role="alert"
            className="rounded-lg border border-red-900/80 bg-red-950/50 px-3 py-2 text-sm text-red-200"
          >
            {formError}
          </p>
        ) : null}

        {formMessage ? (
          <p
            role="status"
            className="rounded-lg border border-emerald-800/80 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-200"
          >
            {formMessage}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isBusy}
          className="w-full rounded-lg bg-cyan-400 px-4 py-2.5 font-semibold text-slate-950 transition hover:bg-cyan-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting
            ? isSignUp
              ? "Creating account…"
              : "Signing in…"
            : isSignUp
              ? "Create account"
              : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-400">
        {isSignUp ? "Already have an account?" : "New to SyncSlate?"}{" "}
        <button
          type="button"
          disabled={isBusy}
          onClick={() => switchMode(isSignUp ? "sign-in" : "sign-up")}
          className="font-medium text-cyan-300 hover:text-cyan-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSignUp ? "Sign in" : "Create an account"}
        </button>
      </p>
    </section>
  );
}
