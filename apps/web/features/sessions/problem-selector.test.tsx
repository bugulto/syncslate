import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ProblemSummary } from "@syncslate/contracts";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { listProblems } from "../../lib/api/problems";
import { ProblemSelector } from "./problem-selector";

vi.mock("../../lib/api/problems", () => ({
  listProblems: vi.fn(),
}));

const problem: ProblemSummary = {
  id: "10000000-0000-4000-8000-000000000001",
  title: "Two Sum",
  slug: "two-sum",
  difficulty: "easy",
  tags: ["arrays", "hash map"],
  visibility: "seeded",
  availableLanguages: ["typescript", "python"],
};

function renderSelector(options?: {
  selectedProblemId?: string | null;
  onSelect?: (selectedProblem: ProblemSummary) => void;
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const onSelect =
    options?.onSelect ?? vi.fn<(problem: ProblemSummary) => void>();

  render(
    <QueryClientProvider client={queryClient}>
      <ProblemSelector
        onSelect={onSelect}
        selectedProblemId={options?.selectedProblemId ?? null}
      />
    </QueryClientProvider>,
  );

  return { onSelect };
}

describe("ProblemSelector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows an initial loading state", () => {
    vi.mocked(listProblems).mockReturnValue(new Promise(() => undefined));

    renderSelector();

    expect(screen.getByRole("status")).toHaveTextContent("Loading problems");
  });

  it("renders server results and selects a problem", async () => {
    vi.mocked(listProblems).mockResolvedValue([problem]);
    const onSelect = vi.fn();

    renderSelector({ onSelect });

    const option = await screen.findByRole("radio", { name: /Two Sum/u });
    fireEvent.click(option);

    expect(screen.getByText("1 problem found")).toBeInTheDocument();
    expect(onSelect).toHaveBeenCalledWith(problem);
  });

  it("applies normalized search, difficulty, tag, and language filters", async () => {
    vi.mocked(listProblems).mockResolvedValue([problem]);
    renderSelector();
    await screen.findByRole("radio", { name: /Two Sum/u });

    fireEvent.change(screen.getByRole("searchbox", { name: "Search" }), {
      target: { value: "  array pairs  " },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Difficulty" }), {
      target: { value: "easy" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Tag" }), {
      target: { value: "  arrays  " },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Language" }), {
      target: { value: "typescript" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));

    await waitFor(() =>
      expect(listProblems).toHaveBeenLastCalledWith({
        q: "array pairs",
        difficulty: "easy",
        tag: "arrays",
        language: "typescript",
      }),
    );
  });

  it("shows an empty state and can clear active filters", async () => {
    vi.mocked(listProblems).mockResolvedValue([]);
    renderSelector();

    expect(await screen.findByText("No problems found")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search" }), {
      target: { value: "missing" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
    await waitFor(() =>
      expect(listProblems).toHaveBeenLastCalledWith({ q: "missing" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(screen.getByRole("searchbox", { name: "Search" })).toHaveValue("");
    await waitFor(() => expect(listProblems).toHaveBeenLastCalledWith({}));
  });

  it("shows a safe failure state and retries", async () => {
    vi.mocked(listProblems)
      .mockRejectedValueOnce(new Error("sensitive backend failure"))
      .mockResolvedValueOnce([problem]);
    renderSelector();

    expect(await screen.findByRole("alert", { name: "" })).toHaveTextContent(
      "Unable to load problems",
    );
    expect(
      screen.queryByText("sensitive backend failure"),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(
      await screen.findByRole("radio", { name: /Two Sum/u }),
    ).toBeInTheDocument();
    expect(listProblems).toHaveBeenCalledTimes(2);
  });
});
