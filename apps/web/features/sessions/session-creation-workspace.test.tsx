import type { SessionDetail } from "@syncslate/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSession } from "../../lib/api/sessions";
import { SessionCreationWorkspace } from "./session-creation-workspace";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("../../lib/api/sessions", () => ({
  createSession: vi.fn(),
}));

vi.mock("./problem-selector", () => ({
  ProblemSelector: ({
    onSelect,
  }: {
    onSelect: (problem: {
      id: string;
      title: string;
      slug: string;
      difficulty: "easy";
      tags: string[];
      visibility: "seeded";
      availableLanguages: ("typescript" | "javascript" | "python")[];
    }) => void;
  }) => (
    <div>
      <button
        onClick={() =>
          onSelect({
            id: "10000000-0000-4000-8000-000000000001",
            title: "Two Sum",
            slug: "two-sum",
            difficulty: "easy",
            tags: ["arrays"],
            visibility: "seeded",
            availableLanguages: ["typescript", "python"],
          })
        }
        type="button"
      >
        Select Two Sum
      </button>
      <button
        onClick={() =>
          onSelect({
            id: "10000000-0000-4000-8000-000000000002",
            title: "Debounce",
            slug: "debounce",
            difficulty: "easy",
            tags: ["functions"],
            visibility: "seeded",
            availableLanguages: ["javascript"],
          })
        }
        type="button"
      >
        Select JavaScript problem
      </button>
    </div>
  ),
}));

const sessionId = "30000000-0000-4000-8000-000000000001";

function renderWorkspace() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <SessionCreationWorkspace />
    </QueryClientProvider>,
  );
}

function fillValidForm() {
  fireEvent.click(screen.getByRole("button", { name: "Select Two Sum" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Session title" }), {
    target: { value: "  Frontend interview  " },
  });
  fireEvent.change(screen.getByRole("combobox", { name: "Language" }), {
    target: { value: "typescript" },
  });
}

describe("SessionCreationWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows only languages supported by the selected problem", () => {
    renderWorkspace();

    const language = screen.getByRole("combobox", { name: "Language" });
    expect(language).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Select Two Sum" }));

    expect(language).toBeEnabled();
    expect(
      screen.getByRole("option", { name: "Typescript" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Python" })).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Javascript" }),
    ).not.toBeInTheDocument();
  });

  it("resets an unsupported language when the selected problem changes", () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Select Two Sum" }));
    const language = screen.getByRole("combobox", { name: "Language" });
    fireEvent.change(language, { target: { value: "python" } });

    fireEvent.click(
      screen.getByRole("button", { name: "Select JavaScript problem" }),
    );

    expect(language).toHaveValue("");
    expect(
      screen.getByRole("option", { name: "Javascript" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Python" }),
    ).not.toBeInTheDocument();
  });

  it("shows accessible field errors without submitting invalid input", () => {
    renderWorkspace();
    fireEvent.change(
      screen.getByRole("spinbutton", { name: "Duration (minutes)" }),
      {
        target: { value: "1" },
      },
    );

    fireEvent.click(screen.getByRole("button", { name: "Create session" }));

    expect(screen.getByText("Title is required")).toBeInTheDocument();
    expect(screen.getByText("Choose a problem.")).toBeInTheDocument();
    expect(screen.getByText("Choose a language.")).toBeInTheDocument();
    expect(
      screen.getByText("Duration must be at least 5 minutes"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "Session title" }),
    ).toHaveAttribute("aria-invalid", "true");
    expect(createSession).not.toHaveBeenCalled();
  });

  it("submits normalized data and navigates to the created session", async () => {
    vi.mocked(createSession).mockResolvedValue({
      id: sessionId,
    } as SessionDetail);
    renderWorkspace();
    fillValidForm();
    fireEvent.change(
      screen.getByRole("spinbutton", { name: "Duration (minutes)" }),
      {
        target: { value: "45" },
      },
    );

    fireEvent.click(screen.getByRole("button", { name: "Create session" }));

    await waitFor(() =>
      expect(createSession).toHaveBeenCalledWith({
        title: "Frontend interview",
        problemId: "10000000-0000-4000-8000-000000000001",
        language: "typescript",
        durationSeconds: 2700,
      }),
    );
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(`/dashboard/sessions/${sessionId}`),
    );
  });

  it("disables submission while creation is pending", async () => {
    let resolveCreation: ((session: SessionDetail) => void) | undefined;
    vi.mocked(createSession).mockReturnValue(
      new Promise((resolve) => {
        resolveCreation = resolve;
      }),
    );
    renderWorkspace();
    fillValidForm();

    fireEvent.click(screen.getByRole("button", { name: "Create session" }));

    const pendingButton = await screen.findByRole("button", {
      name: "Creating session…",
    });
    expect(pendingButton).toBeDisabled();
    expect(createSession).toHaveBeenCalledOnce();

    resolveCreation?.({ id: sessionId } as SessionDetail);
    await waitFor(() => expect(push).toHaveBeenCalled());
  });

  it("shows a safe failure state and allows another attempt", async () => {
    vi.mocked(createSession).mockRejectedValue(
      new Error("sensitive database connection detail"),
    );
    renderWorkspace();
    fillValidForm();

    fireEvent.click(screen.getByRole("button", { name: "Create session" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "We could not create the session. Please try again.",
    );
    expect(alert).not.toHaveTextContent("sensitive database connection detail");
    expect(
      screen.getByRole("button", { name: "Create session" }),
    ).toBeEnabled();
  });
});
