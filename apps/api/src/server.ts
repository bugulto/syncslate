import {
  checkDatabaseConnection,
  createDatabaseClient,
  createProfileIfMissing,
  findProfileByUserId,
  updateProfileMetadata,
} from "@syncslate/database";

import { buildApp } from "./app.js";
import { parseApiEnv } from "./config/env.js";
import { createAccessTokenVerifier } from "./modules/auth/access-token-verifier.js";
import { createProfileBootstrapService } from "./modules/auth/profile-bootstrap.js";
import { createSupabaseAuthClient } from "./modules/auth/supabase-auth.js";

const env = parseApiEnv(process.env);
const database = createDatabaseClient({
  connectionString: env.DATABASE_URL,
});
const supabase = createSupabaseAuthClient({
  url: env.SUPABASE_URL,
  anonKey: env.SUPABASE_ANON_KEY,
});
const verifyAccessToken = createAccessTokenVerifier(supabase);
const bootstrapProfile = createProfileBootstrapService({
  findProfileByUserId: (userId) => findProfileByUserId(database, userId),
  createProfileIfMissing: (input) => createProfileIfMissing(database, input),
  updateProfileMetadata: (input) => updateProfileMetadata(database, input),
});
const app = buildApp({
  logger: {
    level: env.LOG_LEVEL,
  },
  corsAllowedOrigins: env.CORS_ALLOWED_ORIGINS,
  checkReadiness: () => checkDatabaseConnection(database),
  bootstrapProfile,
  verifyAccessToken,
});

app.addHook("onClose", async () => {
  await database.close();
});

let isShuttingDown = false;

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  app.log.info({ signal }, "Shutting down API");

  try {
    await app.close();
  } catch (error) {
    app.log.error(error, "API shutdown failed");
    process.exitCode = 1;
  }
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

try {
  await app.listen({ host: env.HOST, port: env.PORT });
} catch (error) {
  app.log.error(error);
  await app.close();
  process.exitCode = 1;
}
