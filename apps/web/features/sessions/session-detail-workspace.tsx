"use client";

import type { CreateInvitationResponse } from "@syncslate/contracts";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import {
  createSessionInvitation,
  revokeSessionInvitations,
} from "../../lib/api/invitations";
import { ApiRequestError } from "../../lib/api/errors";
import { getSession } from "../../lib/api/sessions";

type SessionDetailWorkspaceProps = {
  sessionId: string;
};

type CopyState = "idle" | "copying" | "copied" | "failed";

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

export function SessionDetailWorkspace({
  sessionId,
}: SessionDetailWorkspaceProps) {
  const [createdInvitation, setCreatedInvitation] =
    useState<CreateInvitationResponse | null>(null);
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [wasRevoked, setWasRevoked] = useState(false);
  const sessionQuery = useQuery({
    queryKey: ["sessions", sessionId],
    queryFn: () => getSession(sessionId),
  });
  const invitationMutation = useMutation({
    mutationFn: () => createSessionInvitation(sessionId),
    onSuccess: (invitation) => {
      setCreatedInvitation(invitation);
      setCopyState("idle");
      setWasRevoked(false);
    },
  });
  const revocationMutation = useMutation({
    mutationFn: () => revokeSessionInvitations(sessionId),
    onSuccess: () => {
      setCreatedInvitation(null);
      invitationMutation.reset();
      setCopyState("idle");
      setWasRevoked(true);
    },
  });

  const candidateLink = createdInvitation
    ? new URL(
        `/join/${encodeURIComponent(createdInvitation.rawToken)}`,
        window.location.origin,
      ).toString()
    : null;

  async function copyCandidateLink() {
    if (!candidateLink) {
      return;
    }

    setCopyState("copying");

    try {
      await navigator.clipboard.writeText(candidateLink);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  if (sessionQuery.isPending) {
    return (
      <section
        aria-label="Session information"
        className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/80 p-6"
      >
        <p className="text-sm text-slate-300" role="status">
          Loading session details…
        </p>
      </section>
    );
  }

  if (sessionQuery.isError) {
    const notFound =
      sessionQuery.error instanceof ApiRequestError &&
      sessionQuery.error.status === 404;

    return (
      <section
        className="mt-8 rounded-2xl border border-red-900/70 bg-red-950/30 p-6"
        role="alert"
      >
        <h2 className="text-lg font-semibold text-red-100">
          {notFound ? "Session not found" : "Unable to load the session"}
        </h2>
        <p className="mt-2 text-sm text-red-200/80">
          {notFound
            ? "This session does not exist or you do not have access to it."
            : "Check your connection and try again."}
        </p>
        {!notFound ? (
          <button
            className="mt-4 rounded-lg border border-red-700 px-3 py-2 text-sm font-semibold text-red-100"
            onClick={() => void sessionQuery.refetch()}
            type="button"
          >
            Retry
          </button>
        ) : null}
      </section>
    );
  }

  const session = sessionQuery.data;

  return (
    <div className="mt-8 space-y-6">
      {session.status === "waiting" ? (
        <section className="rounded-2xl border border-cyan-900/70 bg-cyan-950/30 p-6">
          <p className="text-sm font-semibold tracking-wider text-cyan-300 uppercase">
            Waiting for candidate
          </p>
          <p className="mt-2 text-sm leading-6 text-cyan-100/80">
            Generate an invitation when you are ready to share this session.
          </p>
        </section>
      ) : null}

      <section
        aria-labelledby="session-summary-title"
        className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-slate-400">Session</p>
            <h2
              className="mt-1 text-2xl font-bold text-white"
              id="session-summary-title"
            >
              {session.title}
            </h2>
          </div>
          <span className="rounded-full border border-cyan-700 bg-cyan-950 px-3 py-1 text-sm font-semibold text-cyan-200">
            {formatLabel(session.status)}
          </span>
        </div>

        <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
              Language
            </dt>
            <dd className="mt-1 text-sm font-medium text-slate-200">
              {formatLabel(session.language)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
              Duration
            </dt>
            <dd className="mt-1 text-sm font-medium text-slate-200">
              {session.durationSeconds / 60} minutes
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
              Editing policy
            </dt>
            <dd className="mt-1 text-sm font-medium text-slate-200">
              {formatLabel(session.editingPolicy)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
              Created
            </dt>
            <dd className="mt-1 text-sm font-medium text-slate-200">
              {formatDate(session.createdAt)}
            </dd>
          </div>
        </dl>
      </section>

      <section
        aria-labelledby="selected-problem-title"
        className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6"
      >
        <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
          Selected problem
        </p>
        {session.problem ? (
          <>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h2
                className="text-xl font-semibold text-white"
                id="selected-problem-title"
              >
                {session.problem.title}
              </h2>
              <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-300">
                {formatLabel(session.problem.difficulty)}
              </span>
            </div>
            <p className="mt-3 text-sm text-slate-400">
              {session.problem.tags.join(" · ")}
            </p>
            <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-slate-300">
              {session.problem.descriptionMarkdown}
            </p>
          </>
        ) : (
          <h2
            className="mt-2 text-lg font-semibold text-slate-200"
            id="selected-problem-title"
          >
            Problem no longer available
          </h2>
        )}
      </section>

      <section
        aria-labelledby="invitation-title"
        className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6"
      >
        <h2 className="text-xl font-semibold text-white" id="invitation-title">
          Candidate invitation
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          The secure invitation token is returned only once and remains only in
          this page&apos;s memory.
        </p>

        {createdInvitation && candidateLink ? (
          <div className="mt-5 rounded-xl border border-emerald-800 bg-emerald-950/30 p-4">
            <p className="font-semibold text-emerald-100" role="status">
              Invitation generated
            </p>
            <p className="mt-1 text-sm text-emerald-200/80">
              This link is available only during this page visit. Refreshing
              requires generating a new invitation.
            </p>

            <label
              className="mt-4 block text-sm font-medium text-emerald-100"
              htmlFor="candidate-invitation-link"
            >
              Candidate invitation link
            </label>
            <input
              className="mt-2 w-full rounded-lg border border-emerald-800 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-200"
              id="candidate-invitation-link"
              readOnly
              type="text"
              value={candidateLink}
            />
            <p className="mt-3 text-sm text-emerald-200/80">
              Expires {formatDate(createdInvitation.invitation.expiresAt)}
            </p>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                className="rounded-lg bg-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-950 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={
                  copyState === "copying" || revocationMutation.isPending
                }
                onClick={() => void copyCandidateLink()}
                type="button"
              >
                {copyState === "copying"
                  ? "Copying…"
                  : copyState === "copied"
                    ? "Copied"
                    : "Copy invitation link"}
              </button>
              <button
                className="rounded-lg border border-red-700 px-4 py-2 text-sm font-semibold text-red-200 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={revocationMutation.isPending}
                onClick={() => revocationMutation.mutate()}
                type="button"
              >
                {revocationMutation.isPending
                  ? "Revoking invitation…"
                  : "Revoke invitation"}
              </button>
            </div>

            {copyState === "failed" ? (
              <p className="mt-3 text-sm text-red-200" role="alert">
                Unable to copy the link. Select and copy it manually.
              </p>
            ) : null}
          </div>
        ) : (
          <>
            {wasRevoked ? (
              <p
                className="mt-5 rounded-xl border border-slate-700 bg-slate-950/50 p-4 text-sm text-slate-200"
                role="status"
              >
                Invitation revoked. You can generate a new link when ready.
              </p>
            ) : null}
            <button
              className="mt-5 rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={invitationMutation.isPending}
              onClick={() => invitationMutation.mutate()}
              type="button"
            >
              {invitationMutation.isPending
                ? "Generating invitation…"
                : wasRevoked
                  ? "Generate new invitation"
                  : "Generate invitation"}
            </button>
          </>
        )}

        {invitationMutation.isError ? (
          <div
            className="mt-4 rounded-xl border border-red-900/70 bg-red-950/30 p-4 text-sm text-red-100"
            role="alert"
          >
            We could not generate the invitation. Please try again.
          </div>
        ) : null}

        {revocationMutation.isError ? (
          <div
            className="mt-4 rounded-xl border border-red-900/70 bg-red-950/30 p-4 text-sm text-red-100"
            role="alert"
          >
            We could not revoke the invitation. Please try again.
          </div>
        ) : null}
      </section>
    </div>
  );
}
