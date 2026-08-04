import {
  checkDatabaseConnection,
  createDatabaseClient,
} from "@syncslate/database";

import { buildApp } from "./app.js";
import { parseApiEnv } from "./config/env.js";

const env = parseApiEnv(process.env);
const database = createDatabaseClient({
  connectionString: env.DATABASE_URL,
});
const app = buildApp({
  logger: {
    level: env.LOG_LEVEL,
  },
  checkReadiness: () => checkDatabaseConnection(database),
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
