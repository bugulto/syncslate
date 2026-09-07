import Link from "next/link";
import { redirect } from "next/navigation";

import { SessionCreationWorkspace } from "../../../../features/sessions/session-creation-workspace";
import { getCurrentUser } from "../../../../lib/api/current-user";
import { AuthenticationRequiredError } from "../../../../lib/api/errors";
import { createServerApiClient } from "../../../../lib/api/server";

export default async function NewSessionPage() {
  try {
    const apiClient = await createServerApiClient();
    await getCurrentUser(apiClient);
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      redirect("/sign-in");
    }

    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-12 text-slate-100">
        <section className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center shadow-xl">
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Unable to start session creation
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            We could not load the required account information. Please try
            again.
          </p>
          <Link
            className="mt-6 inline-flex rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950"
            href="/dashboard/sessions/new"
          >
            Try again
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <section
        className="mx-auto max-w-5xl"
        aria-labelledby="new-session-title"
      >
        <Link
          className="text-sm font-semibold text-cyan-300 hover:text-cyan-200"
          href="/dashboard"
        >
          ← Back to dashboard
        </Link>
        <p className="mt-8 text-sm font-semibold tracking-widest text-cyan-300 uppercase">
          New interview
        </p>
        <h1
          className="mt-3 text-3xl font-bold tracking-tight text-white"
          id="new-session-title"
        >
          Create a session
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
          Start by choosing the problem the candidate will work through.
        </p>

        <SessionCreationWorkspace />
      </section>
    </main>
  );
}
