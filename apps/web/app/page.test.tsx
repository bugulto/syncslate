import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "./page";

describe("HomePage", () => {
  it("introduces the product with an accessible heading", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "SyncSlate" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Real-time technical interviews, in one focused workspace.",
      ),
    ).toBeInTheDocument();
  });
});
