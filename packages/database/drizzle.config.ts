import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

import { defineConfig } from "drizzle-kit";

const apiEnvPath = fileURLToPath(
  new URL("../../apps/api/.env", import.meta.url),
);

if (existsSync(apiEnvPath)) {
  loadEnvFile(apiEnvPath);
}

const migrationDatabaseUrl =
  process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;

if (!migrationDatabaseUrl) {
  throw new Error(
    "DIRECT_DATABASE_URL or DATABASE_URL is required for database commands",
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: migrationDatabaseUrl,
  },
  strict: true,
  verbose: true,
});
