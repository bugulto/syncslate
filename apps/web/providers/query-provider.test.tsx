import { useQueryClient } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { QueryProvider } from "./query-provider";

function QueryConsumer() {
  const queryClient = useQueryClient();

  return <span>{queryClient ? "Query client ready" : "Unavailable"}</span>;
}

describe("QueryProvider", () => {
  it("provides a query client to browser components", () => {
    render(
      <QueryProvider>
        <QueryConsumer />
      </QueryProvider>,
    );

    expect(screen.getByText("Query client ready")).toBeInTheDocument();
  });
});
