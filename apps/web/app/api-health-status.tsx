"use client";

import { healthResponseSchema } from "@syncslate/contracts";
import { useEffect, useState } from "react";

type ApiHealthStatusProps = {
  apiUrl: string;
};

type ConnectionStatus = "checking" | "connected" | "unavailable";

const statusContent: Record<
  ConnectionStatus,
  { label: string; indicatorClassName: string }
> = {
  checking: {
    label: "Checking API…",
    indicatorClassName: "bg-amber-400",
  },
  connected: {
    label: "API connected",
    indicatorClassName: "bg-emerald-400",
  },
  unavailable: {
    label: "API unavailable",
    indicatorClassName: "bg-rose-400",
  },
};

export function ApiHealthStatus({ apiUrl }: ApiHealthStatusProps) {
  const [status, setStatus] = useState<ConnectionStatus>("checking");

  useEffect(() => {
    const controller = new AbortController();

    async function checkApiHealth() {
      try {
        const response = await fetch(`${apiUrl}/health`, {
          headers: { accept: "application/json" },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Health request failed with ${response.status}`);
        }

        healthResponseSchema.parse(await response.json());
        setStatus("connected");
      } catch {
        if (!controller.signal.aborted) {
          setStatus("unavailable");
        }
      }
    }

    void checkApiHealth();

    return () => controller.abort();
  }, [apiUrl]);

  const content = statusContent[status];

  return (
    <p
      aria-label={content.label}
      className="mt-8 inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-200"
      role="status"
    >
      <span
        aria-hidden="true"
        className={`size-2 rounded-full ${content.indicatorClassName}`}
      />
      {content.label}
    </p>
  );
}
