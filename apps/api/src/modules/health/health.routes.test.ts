import { afterEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "../../app.js";

const apps = new Set<ReturnType<typeof buildApp>>();

afterEach(async () => {
  await Promise.all([...apps].map((app) => app.close()));
  apps.clear();
});

describe("GET /api/v1/health", () => {
  it("reports that the API is healthy", async () => {
    const app = buildApp({
      logger: false,
      corsAllowedOrigins: ["http://localhost:3000"],
      checkReadiness: vi.fn(async () => undefined),
    });
    apps.add(app);

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });

  it("allows the configured web origin", async () => {
    const app = buildApp({
      logger: false,
      corsAllowedOrigins: ["http://localhost:3000"],
      checkReadiness: vi.fn(async () => undefined),
    });
    apps.add(app);

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/health",
      headers: { origin: "http://localhost:3000" },
    });

    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:3000",
    );
  });
});

describe("GET /api/v1/ready", () => {
  it("reports ready when required dependencies are available", async () => {
    const checkReadiness = vi.fn(async () => undefined);
    const app = buildApp({
      logger: false,
      corsAllowedOrigins: ["http://localhost:3000"],
      checkReadiness,
    });
    apps.add(app);

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/ready",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ready" });
    expect(checkReadiness).toHaveBeenCalledOnce();
  });

  it("reports not ready without exposing dependency errors", async () => {
    const checkReadiness = vi.fn(async () => {
      throw new Error("sensitive database connection detail");
    });
    const app = buildApp({
      logger: false,
      corsAllowedOrigins: ["http://localhost:3000"],
      checkReadiness,
    });
    apps.add(app);

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/ready",
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ status: "not_ready" });
    expect(response.body).not.toContain("sensitive database connection detail");
  });
});
