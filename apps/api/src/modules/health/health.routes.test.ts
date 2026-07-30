import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../app.js";

const apps = new Set<ReturnType<typeof buildApp>>();

afterEach(async () => {
  await Promise.all([...apps].map((app) => app.close()));
  apps.clear();
});

describe("GET /api/v1/health", () => {
  it("reports that the API is healthy", async () => {
    const app = buildApp({ logger: false });
    apps.add(app);

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });
});
