import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import HomePage from "./page";

describe("HomePage", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:4000/api/v1");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("introduces the product with an accessible heading", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(new Promise(() => undefined)),
    );
    render(<HomePage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "SyncSlate" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Real-time technical interviews, in one focused workspace.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Checking API…");
  });

  it("shows when the API is connected", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ status: "ok" }),
      }),
    );

    render(<HomePage />);

    expect(
      await screen.findByRole("status", { name: "API connected" }),
    ).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/health",
      expect.objectContaining({
        headers: { accept: "application/json" },
      }),
    );
  });

  it("shows when the API response is unavailable or invalid", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ status: "unexpected" }),
      }),
    );

    render(<HomePage />);

    expect(
      await screen.findByRole("status", { name: "API unavailable" }),
    ).toBeInTheDocument();
  });
});
