import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DashboardLoading from "./loading";

describe("DashboardLoading", () => {
  it("announces that the dashboard is loading", () => {
    render(<DashboardLoading />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading dashboard");
    expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true");
  });
});
