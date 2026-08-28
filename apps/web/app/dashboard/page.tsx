import type { CurrentUser } from "@syncslate/contracts";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "../../lib/api/current-user";
import { AuthenticationRequiredError } from "../../lib/api/errors";
import { createServerApiClient } from "../../lib/api/server";

function getInitials(displayName: string): string {
  const nameParts = displayName.split(/\s+/u);
  const firstName = nameParts[0] ?? "";
  const lastName = nameParts.length > 1 ? (nameParts.at(-1) ?? "") : "";
  const characters = lastName
    ? [Array.from(firstName)[0], Array.from(lastName)[0]]
    : Array.from(firstName).slice(0, 2);

  return characters.filter(Boolean).join("").toUpperCase();
}

export default async function DashboardPage() {
  let currentUser: CurrentUser;

  try {
    const apiClient = await createServerApiClient();

    currentUser = await getCurrentUser(apiClient);
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      redirect("/sign-in");
    }

    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-12 text-slate-100">
        <section
          aria-labelledby="dashboard-error-title"
          className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center shadow-xl"
        >
          <h1
            id="dashboard-error-title"
            className="text-2xl font-bold tracking-tight text-white"
          >
            Unable to load your dashboard
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            We could not reach the SyncSlate API. Please try again.
          </p>
          <Link
            className="mt-6 inline-flex rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
            href="/dashboard"
          >
            Try again
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <section aria-labelledby="dashboard-title" className="mx-auto max-w-5xl">
        <p className="text-sm font-semibold tracking-widest text-cyan-300 uppercase">
          Interviewer workspace
        </p>
        <h1
          id="dashboard-title"
          className="mt-3 text-3xl font-bold tracking-tight text-white"
        >
          Dashboard
        </h1>

        <section
          aria-label="Interviewer profile"
          className="mt-8 flex items-center gap-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-5"
        >
          {currentUser.avatarUrl ? (
            // Provider avatar hosts are dynamic, so they cannot be safely
            // allowlisted for the Next.js image optimizer.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={`${currentUser.displayName}'s avatar`}
              className="size-12 rounded-full object-cover ring-2 ring-slate-700"
              height={48}
              referrerPolicy="no-referrer"
              src={currentUser.avatarUrl}
              width={48}
            />
          ) : (
            <span
              aria-label={`${currentUser.displayName}'s initials`}
              className="flex size-12 shrink-0 items-center justify-center rounded-full bg-cyan-400 text-sm font-bold text-slate-950"
              role="img"
            >
              {getInitials(currentUser.displayName)}
            </span>
          )}
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
              Signed in as
            </p>
            <p className="mt-1 truncate font-semibold text-white">
              {currentUser.displayName}
            </p>
            {currentUser.email ? (
              <p className="mt-1 truncate text-sm text-slate-400">
                {currentUser.email}
              </p>
            ) : null}
          </div>
        </section>

        <div className="mt-10 rounded-2xl border border-dashed border-slate-700 bg-slate-900/60 px-6 py-12 text-center">
          <h2 className="text-lg font-semibold text-slate-100">
            No interview sessions yet
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Session creation and interview history will be added in a later
            milestone.
          </p>
        </div>
      </section>
    </main>
  );
}
