import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

import { defineConfig, devices } from "@playwright/test";

const webUrl = "http://localhost:3000";
const apiUrl = "http://localhost:4000";
const localEnvPaths = [
  fileURLToPath(new URL(".env.local", import.meta.url)),
  fileURLToPath(new URL("../api/.env", import.meta.url)),
];

for (const envPath of localEnvPaths) {
  if (existsSync(envPath)) {
    loadEnvFile(envPath);
  }
}

function requiredEnvironmentValue(name: string, fallbackName?: string): string {
  const value =
    process.env[name] ?? (fallbackName ? process.env[fallbackName] : undefined);

  if (!value) {
    throw new Error(
      `Playwright requires ${name}${fallbackName ? ` or ${fallbackName}` : ""}.`,
    );
  }

  return value;
}

const databaseUrl = requiredEnvironmentValue("DATABASE_URL", "DB_URL");
const apiSupabaseUrl = requiredEnvironmentValue("SUPABASE_URL", "API_URL");
const apiSupabaseAnonKey = requiredEnvironmentValue(
  "SUPABASE_ANON_KEY",
  "ANON_KEY",
);
const webSupabaseUrl = requiredEnvironmentValue(
  "NEXT_PUBLIC_SUPABASE_URL",
  "API_URL",
);
const webSupabaseAnonKey = requiredEnvironmentValue(
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "ANON_KEY",
);

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
        PORT: "4000",
        CORS_ALLOWED_ORIGINS: webUrl,
        DATABASE_URL: databaseUrl,
        SUPABASE_URL: apiSupabaseUrl,
        SUPABASE_ANON_KEY: apiSupabaseAnonKey,
      },
    },
    {
      command: "pnpm --filter @syncslate/web dev",
      url: webUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        PORT: "3000",
        NEXT_PUBLIC_API_URL: `${apiUrl}/api/v1`,
        NEXT_PUBLIC_SUPABASE_URL: webSupabaseUrl,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: webSupabaseAnonKey,
      },
    },
  ],
});
