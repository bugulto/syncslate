"use client";

import {
  problemDifficultyValues,
  supportedLanguageValues,
  type ListProblemsQuery,
  type ProblemDifficulty,
  type ProblemSummary,
  type SupportedLanguage,
} from "@syncslate/contracts";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { listProblems } from "../../lib/api/problems";

type ProblemSelectorProps = {
  selectedProblemId: string | null;
  onSelect: (problem: ProblemSummary) => void;
};

type FilterDraft = {
  q: string;
  difficulty: "" | ProblemDifficulty;
  tag: string;
  language: "" | SupportedLanguage;
};

const emptyFilters: FilterDraft = {
  q: "",
  difficulty: "",
  tag: "",
  language: "",
};

function toProblemQuery(filters: FilterDraft): ListProblemsQuery {
  const q = filters.q.trim();
  const tag = filters.tag.trim();

  return {
    ...(q ? { q } : {}),
    ...(filters.difficulty ? { difficulty: filters.difficulty } : {}),
    ...(tag ? { tag } : {}),
    ...(filters.language ? { language: filters.language } : {}),
  };
}

function formatOption(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function ProblemSelector({
  selectedProblemId,
  onSelect,
}: ProblemSelectorProps) {
  const [draft, setDraft] = useState<FilterDraft>(emptyFilters);
  const [filters, setFilters] = useState<ListProblemsQuery>({});
  const problemsQuery = useQuery({
    queryKey: ["problems", filters],
    queryFn: () => listProblems(filters),
  });

  function applyFilters() {
    setFilters(toProblemQuery(draft));
  }

  function clearFilters() {
    setDraft(emptyFilters);
    setFilters({});
  }

  return (
    <section
      aria-labelledby="problem-selector-title"
      className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6"
    >
      <div>
        <h2
          className="text-xl font-semibold text-white"
          id="problem-selector-title"
        >
          Choose a problem
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Search the problem library or narrow it with filters.
        </p>
      </div>

      <div
        className="mt-6 grid gap-4 md:grid-cols-2"
        role="group"
        aria-label="Problem filters"
      >
        <label className="text-sm font-medium text-slate-200">
          Search
          <input
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-400"
            onChange={(event) =>
              setDraft((current) => ({ ...current, q: event.target.value }))
            }
            placeholder="Search titles and descriptions"
            type="search"
            value={draft.q}
          />
        </label>

        <label className="text-sm font-medium text-slate-200">
          Difficulty
          <select
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-400"
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                difficulty: event.target.value as FilterDraft["difficulty"],
              }))
            }
            value={draft.difficulty}
          >
            <option value="">All difficulties</option>
            {problemDifficultyValues.map((difficulty) => (
              <option key={difficulty} value={difficulty}>
                {formatOption(difficulty)}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium text-slate-200">
          Tag
          <input
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-400"
            onChange={(event) =>
              setDraft((current) => ({ ...current, tag: event.target.value }))
            }
            placeholder="For example, arrays"
            type="text"
            value={draft.tag}
          />
        </label>

        <label className="text-sm font-medium text-slate-200">
          Language
          <select
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-400"
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                language: event.target.value as FilterDraft["language"],
              }))
            }
            value={draft.language}
          >
            <option value="">All languages</option>
            {supportedLanguageValues.map((language) => (
              <option key={language} value={language}>
                {formatOption(language)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={problemsQuery.isFetching}
          onClick={applyFilters}
          type="button"
        >
          Apply filters
        </button>
        <button
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-slate-500"
          onClick={clearFilters}
          type="button"
        >
          Clear filters
        </button>
      </div>

      <div className="mt-8" aria-live="polite">
        {problemsQuery.isPending ? (
          <div
            className="rounded-xl border border-slate-800 bg-slate-950/60 p-6"
            role="status"
          >
            <p className="font-semibold text-slate-200">Loading problems…</p>
          </div>
        ) : null}

        {problemsQuery.isError ? (
          <div
            className="rounded-xl border border-red-900/70 bg-red-950/30 p-6"
            role="alert"
          >
            <p className="font-semibold text-red-100">
              Unable to load problems
            </p>
            <p className="mt-1 text-sm text-red-200/80">
              Check your connection and try again.
            </p>
            <button
              className="mt-4 rounded-lg border border-red-700 px-3 py-2 text-sm font-semibold text-red-100"
              onClick={() => void problemsQuery.refetch()}
              type="button"
            >
              Retry
            </button>
          </div>
        ) : null}

        {problemsQuery.isSuccess && problemsQuery.data.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/40 p-8 text-center">
            <p className="font-semibold text-slate-200">No problems found</p>
            <p className="mt-1 text-sm text-slate-400">
              Adjust or clear the filters to see more problems.
            </p>
          </div>
        ) : null}

        {problemsQuery.isSuccess && problemsQuery.data.length > 0 ? (
          <fieldset>
            <legend className="sr-only">Problem results</legend>
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-slate-400">
                {problemsQuery.data.length} problem
                {problemsQuery.data.length === 1 ? "" : "s"} found
              </p>
              {problemsQuery.isFetching ? (
                <p className="text-sm text-cyan-300" role="status">
                  Updating results…
                </p>
              ) : null}
            </div>
            <div className="mt-3 grid gap-3">
              {problemsQuery.data.map((problem) => {
                const selected = selectedProblemId === problem.id;

                return (
                  <label
                    className={`cursor-pointer rounded-xl border p-4 transition ${
                      selected
                        ? "border-cyan-400 bg-cyan-400/10"
                        : "border-slate-800 bg-slate-950/50 hover:border-slate-600"
                    }`}
                    key={problem.id}
                  >
                    <span className="flex items-start gap-3">
                      <input
                        checked={selected}
                        className="mt-1 accent-cyan-400"
                        name="problem"
                        onChange={() => onSelect(problem)}
                        type="radio"
                        value={problem.id}
                      />
                      <span className="min-w-0">
                        <span className="block font-semibold text-white">
                          {problem.title}
                        </span>
                        <span className="mt-1 block text-sm text-slate-400">
                          {formatOption(problem.difficulty)} ·{" "}
                          {problem.tags.join(", ")} ·{" "}
                          {problem.availableLanguages
                            .map(formatOption)
                            .join(", ")}
                        </span>
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ) : null}
      </div>
    </section>
  );
}
