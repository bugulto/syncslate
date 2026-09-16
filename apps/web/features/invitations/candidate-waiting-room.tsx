"use client";

import {
  joinInvitationRequestSchema,
  type InspectInvitationResponse,
  type JoinInvitationRequest,
} from "@syncslate/contracts";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import { inspectInvitation, joinInvitation } from "../../lib/api/invitations";

type CandidateWaitingRoomProps = {
  inviteToken: string;
};

function formatLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDuration(durationSeconds: number): string {
  const minutes = Math.round(durationSeconds / 60);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

function InvitationPreview({
  response,
}: {
  response: InspectInvitationResponse;
}) {
  const { session } = response.invitation;

  return (
    <section
      aria-labelledby="invitation-preview-title"
      className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl"
    >
      <p className="text-sm font-semibold tracking-widest text-cyan-300 uppercase">
        Interview invitation
      </p>
      <h1
        className="mt-3 text-3xl font-bold tracking-tight text-white"
        id="invitation-preview-title"
      >
        {session.title}
      </h1>

      <dl className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-slate-950/70 p-4">
          <dt className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
            Status
          </dt>
          <dd className="mt-1 font-medium text-slate-100">
            {formatLabel(session.status)}
          </dd>
        </div>
        <div className="rounded-xl bg-slate-950/70 p-4">
          <dt className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
            Language
          </dt>
          <dd className="mt-1 font-medium text-slate-100">
            {formatLabel(session.language)}
          </dd>
        </div>
        <div className="rounded-xl bg-slate-950/70 p-4">
          <dt className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
            Duration
          </dt>
          <dd className="mt-1 font-medium text-slate-100">
            {formatDuration(session.durationSeconds)}
          </dd>
        </div>
      </dl>

      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
        <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
          Problem
        </p>
        {session.problem ? (
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="font-semibold text-white">{session.problem.title}</p>
            <span className="rounded-full border border-slate-700 px-2 py-0.5 text-xs font-medium text-slate-300">
              {formatLabel(session.problem.difficulty)}
            </span>
          </div>
        ) : (
          <p className="mt-1 text-sm text-slate-300">
            No problem assigned yet.
          </p>
        )}
      </div>
    </section>
  );
}

export function CandidateWaitingRoom({
  inviteToken,
}: CandidateWaitingRoomProps) {
  const [displayName, setDisplayName] = useState("");
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);
  const invitationQuery = useQuery({
    queryKey: ["invitation-preview", inviteToken],
    queryFn: () => inspectInvitation(inviteToken),
    retry: false,
  });
  const joinMutation = useMutation({
    mutationFn: (input: JoinInvitationRequest) =>
      joinInvitation(inviteToken, input),
  });

  function submitDisplayName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (joinMutation.isPending) {
      return;
    }

    const result = joinInvitationRequestSchema.safeParse({ displayName });

    if (!result.success) {
      setDisplayNameError(
        result.error.flatten().fieldErrors.displayName?.[0] ??
          "Enter a valid display name.",
      );
      return;
    }

    setDisplayNameError(null);
    joinMutation.mutate(result.data);
  }

  if (invitationQuery.isPending) {
    return (
      <section
        className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center shadow-xl"
        role="status"
      >
        <h1 className="text-2xl font-bold text-white">
          Checking your invitation
        </h1>
        <p className="mt-3 text-sm text-slate-400">
          Please wait while we load the interview details.
        </p>
      </section>
    );
  }

  if (invitationQuery.isError) {
    return (
      <section
        aria-labelledby="invitation-error-title"
        className="w-full max-w-lg rounded-2xl border border-red-900/70 bg-red-950/30 p-8 text-center shadow-xl"
        role="alert"
      >
        <h1
          className="text-2xl font-bold text-red-100"
          id="invitation-error-title"
        >
          Unable to open this invitation
        </h1>
        <p className="mt-3 text-sm leading-6 text-red-200/80">
          The invitation may be unavailable, or the service could not be
          reached.
        </p>
        <button
          className="mt-6 rounded-lg border border-red-700 px-4 py-2 text-sm font-semibold text-red-100 hover:border-red-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-300"
          onClick={() => void invitationQuery.refetch()}
          type="button"
        >
          Retry
        </button>
      </section>
    );
  }

  if (joinMutation.isSuccess) {
    return (
      <section
        aria-labelledby="candidate-admitted-title"
        className="w-full max-w-2xl rounded-2xl border border-emerald-800 bg-emerald-950/30 p-8 text-center shadow-xl"
      >
        <p className="text-sm font-semibold tracking-widest text-emerald-300 uppercase">
          Invitation accepted
        </p>
        <h1
          className="mt-3 text-3xl font-bold text-white"
          id="candidate-admitted-title"
        >
          Welcome, {joinMutation.data.participant.displayName}
        </h1>
        <p className="mt-3 text-sm text-emerald-100/80" role="status">
          Your room access is ready. Keep this page open while SyncSlate
          prepares the live room.
        </p>
      </section>
    );
  }

  return (
    <div className="w-full max-w-2xl">
      <InvitationPreview response={invitationQuery.data} />

      <section
        aria-labelledby="candidate-details-title"
        className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl"
      >
        <h2
          className="text-xl font-semibold text-white"
          id="candidate-details-title"
        >
          Join the interview
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Enter the name the interviewer should see in the room.
        </p>

        <form className="mt-6" noValidate onSubmit={submitDisplayName}>
          <label
            className="text-sm font-medium text-slate-200"
            htmlFor="candidate-display-name"
          >
            Display name
          </label>
          <input
            aria-describedby={
              displayNameError ? "candidate-display-name-error" : undefined
            }
            aria-invalid={Boolean(displayNameError)}
            autoComplete="name"
            autoFocus
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-400 focus-visible:ring-2 focus-visible:ring-cyan-300/40"
            id="candidate-display-name"
            maxLength={20}
            onChange={(event) => {
              setDisplayName(event.target.value);
              setDisplayNameError(null);
              joinMutation.reset();
            }}
            placeholder="Your name"
            type="text"
            value={displayName}
          />
          {displayNameError ? (
            <p
              className="mt-2 text-sm font-medium text-red-300"
              id="candidate-display-name-error"
              role="alert"
            >
              {displayNameError}
            </p>
          ) : null}

          {joinMutation.isError ? (
            <div
              className="mt-4 rounded-xl border border-red-900/70 bg-red-950/30 p-4 text-sm text-red-100"
              role="alert"
            >
              We could not join the interview. Check the invitation and try
              again.
            </div>
          ) : null}

          <button
            className="mt-6 w-full rounded-lg bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={joinMutation.isPending}
            type="submit"
          >
            {joinMutation.isPending ? "Joining interview..." : "Join interview"}
          </button>
        </form>
      </section>
    </div>
  );
}
