"use client";

import { useActionState } from "react";

import { signOutAction, type SignOutActionState } from "./sign-out.action";

const initialState: SignOutActionState = { error: null };

export function SignOutButton() {
  const [state, formAction, isPending] = useActionState(
    signOutAction,
    initialState,
  );

  return (
    <form action={formAction} className="ml-auto text-right">
      <button
        className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-wait disabled:opacity-60"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Signing out…" : "Sign out"}
      </button>
      {state.error ? (
        <p className="mt-2 max-w-64 text-sm text-red-300" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
