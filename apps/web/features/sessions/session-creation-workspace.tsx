"use client";

import {
  createSessionRequestSchema,
  type CreateSessionRequest,
  type ProblemSummary,
  type SupportedLanguage,
} from "@syncslate/contracts";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { createSession } from "../../lib/api/sessions";
import { ProblemSelector } from "./problem-selector";

type FieldErrors = Partial<Record<keyof CreateSessionRequest, string>>;

function formatLanguage(language: SupportedLanguage): string {
  return language.charAt(0).toUpperCase() + language.slice(1);
}

export function SessionCreationWorkspace() {
  const router = useRouter();
  const [selectedProblem, setSelectedProblem] = useState<ProblemSummary | null>(
    null,
  );
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState<"" | SupportedLanguage>("");
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const createSessionMutation = useMutation({
    mutationFn: (input: CreateSessionRequest) => createSession(input),
    onSuccess: (session) => {
      router.push(`/dashboard/sessions/${session.id}`);
    },
  });

  function clearFieldError(field: keyof CreateSessionRequest) {
    setFieldErrors((current) => {
      const nextErrors = { ...current };
      delete nextErrors[field];
      return nextErrors;
    });
  }

  function selectProblem(problem: ProblemSummary) {
    setSelectedProblem(problem);
    clearFieldError("problemId");

    if (language && !problem.availableLanguages.includes(language)) {
      setLanguage("");
    }
  }

  function submitSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (createSessionMutation.isPending) {
      return;
    }

    const result = createSessionRequestSchema.safeParse({
      title,
      problemId: selectedProblem?.id ?? "",
      language,
      durationSeconds: Number(durationMinutes) * 60,
    });

    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      const nextErrors: FieldErrors = {};

      if (errors.title?.[0]) {
        nextErrors.title = errors.title[0];
      }
      if (!selectedProblem) {
        nextErrors.problemId = "Choose a problem.";
      } else if (errors.problemId?.[0]) {
        nextErrors.problemId = errors.problemId[0];
      }
      if (!language) {
        nextErrors.language = "Choose a language.";
      } else if (errors.language?.[0]) {
        nextErrors.language = errors.language[0];
      }
      if (errors.durationSeconds?.[0]) {
        nextErrors.durationSeconds = errors.durationSeconds[0];
      }

      setFieldErrors(nextErrors);
      return;
    }

    setFieldErrors({});
    createSessionMutation.mutate(result.data);
  }

  return (
    <form className="mt-8 space-y-6" noValidate onSubmit={submitSession}>
      <ProblemSelector
        onSelect={selectProblem}
        selectedProblemId={selectedProblem?.id ?? null}
      />

      {fieldErrors.problemId ? (
        <p className="text-sm font-medium text-red-300" role="alert">
          {fieldErrors.problemId}
        </p>
      ) : null}

      <section
        aria-labelledby="session-details-title"
        className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6"
      >
        <h2
          className="text-xl font-semibold text-white"
          id="session-details-title"
        >
          Session details
        </h2>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <label
              className="text-sm font-medium text-slate-200"
              htmlFor="session-title"
            >
              Session title
            </label>
            <input
              aria-describedby={
                fieldErrors.title ? "session-title-error" : undefined
              }
              aria-invalid={Boolean(fieldErrors.title)}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-400"
              id="session-title"
              maxLength={120}
              onChange={(event) => {
                setTitle(event.target.value);
                clearFieldError("title");
              }}
              placeholder="For example, Frontend technical interview"
              type="text"
              value={title}
            />
            {fieldErrors.title ? (
              <span
                className="mt-2 block text-sm text-red-300"
                id="session-title-error"
              >
                {fieldErrors.title}
              </span>
            ) : null}
          </div>

          <div>
            <label
              className="text-sm font-medium text-slate-200"
              htmlFor="session-language"
            >
              Language
            </label>
            <select
              aria-describedby={
                fieldErrors.language ? "session-language-error" : undefined
              }
              aria-invalid={Boolean(fieldErrors.language)}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={selectedProblem === null}
              id="session-language"
              onChange={(event) => {
                setLanguage(event.target.value as "" | SupportedLanguage);
                clearFieldError("language");
              }}
              value={language}
            >
              <option value="">
                {selectedProblem
                  ? "Choose a language"
                  : "Select a problem first"}
              </option>
              {selectedProblem?.availableLanguages.map((availableLanguage) => (
                <option key={availableLanguage} value={availableLanguage}>
                  {formatLanguage(availableLanguage)}
                </option>
              ))}
            </select>
            {fieldErrors.language ? (
              <span
                className="mt-2 block text-sm text-red-300"
                id="session-language-error"
              >
                {fieldErrors.language}
              </span>
            ) : null}
          </div>

          <div>
            <label
              className="text-sm font-medium text-slate-200"
              htmlFor="session-duration"
            >
              Duration (minutes)
            </label>
            <input
              aria-describedby={
                fieldErrors.durationSeconds
                  ? "session-duration-error"
                  : undefined
              }
              aria-invalid={Boolean(fieldErrors.durationSeconds)}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-400"
              id="session-duration"
              inputMode="numeric"
              max={180}
              min={5}
              onChange={(event) => {
                setDurationMinutes(event.target.value);
                clearFieldError("durationSeconds");
              }}
              step={5}
              type="number"
              value={durationMinutes}
            />
            {fieldErrors.durationSeconds ? (
              <span
                className="mt-2 block text-sm text-red-300"
                id="session-duration-error"
              >
                {fieldErrors.durationSeconds}
              </span>
            ) : null}
          </div>
        </div>
      </section>

      {createSessionMutation.isError ? (
        <div
          className="rounded-xl border border-red-900/70 bg-red-950/30 p-4 text-sm text-red-100"
          role="alert"
        >
          We could not create the session. Please try again.
        </div>
      ) : null}

      <div className="flex justify-end">
        <button
          className="rounded-lg bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={createSessionMutation.isPending}
          type="submit"
        >
          {createSessionMutation.isPending
            ? "Creating session…"
            : "Create session"}
        </button>
      </div>
    </form>
  );
}
