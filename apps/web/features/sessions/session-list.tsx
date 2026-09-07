"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { listSessions } from "../../lib/api/sessions";

function formatLabel(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function SessionList() {
  const sessionsQuery = useQuery({
    queryKey: ["sessions"],
    queryFn: () => listSessions(),
  });

  if (sessionsQuery.isPending) {
    return (
      <div
        className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/60 px-6 py-8"
        role="status"
      >
        <p className="font-semibold text-slate-200">Loading interviews…</p>
      </div>
    );
  }

  if (sessionsQuery.isError) {
    return (
      <div
        className="mt-4 rounded-2xl border border-red-900/70 bg-red-950/30 px-6 py-8"
        role="alert"
      >
        <p className="font-semibold text-red-100">Unable to load interviews</p>
        <p className="mt-2 text-sm text-red-200/80">
          Check your connection and try again.
        </p>
        <button
          className="mt-4 rounded-lg border border-red-700 px-3 py-2 text-sm font-semibold text-red-100"
          onClick={() => void sessionsQuery.refetch()}
          type="button"
        >
          Retry
        </button>
      </div>
    );
  }

  if (sessionsQuery.data.length === 0) {
    return (
      <div className="mt-4 rounded-2xl border border-dashed border-slate-700 bg-slate-900/60 px-6 py-12 text-center">
        <h3 className="text-lg font-semibold text-slate-100">
          No interviews yet
        </h3>
        <p className="mt-2 text-sm text-slate-400">
          Create your first interview to get started.
        </p>
      </div>
    );
  }

  return (
    <ul className="mt-4 grid gap-4">
      {sessionsQuery.data.map((session) => (
        <li key={session.id}>
          <Link
            className="block rounded-2xl border border-slate-800 bg-slate-900/70 p-5 transition hover:border-cyan-700 hover:bg-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
            href={`/dashboard/sessions/${session.id}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold text-white">{session.title}</h3>
                <p className="mt-1 text-sm text-slate-400">
                  {session.problem?.title ?? "Problem no longer available"}
                </p>
              </div>
              <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs font-semibold text-slate-300">
                {formatLabel(session.status)}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-400">
              <span>{formatLabel(session.language)}</span>
              <span>{session.durationSeconds / 60} minutes</span>
              <time dateTime={session.createdAt}>
                {formatDate(session.createdAt)}
              </time>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
