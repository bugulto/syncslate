import { defineConfig, devices } from "@playwright/test";

const webUrl = "http://localhost:3000";
const apiUrl = "http://localhost:4000";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  ...(process.env.CI ? { workers: 1 } : {}),
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: webUrl,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "pnpm --filter @syncslate/api dev",
      url: `${apiUrl}/api/v1/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        CORS_ALLOWED_ORIGINS: webUrl,
        DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
      },
    },
    {
      command: "pnpm --filter @syncslate/web dev",
      url: webUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        NEXT_PUBLIC_API_URL: `${apiUrl}/api/v1`,
      },
    },
  ],
});
