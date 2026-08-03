import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { Pool } from "pg";

import { parseDatabaseConfig } from "./config.js";

type CreateDatabaseClientOptions = {
  connectionString: string | undefined;
  maxConnections?: number;
};

export function createDatabaseClient(options: CreateDatabaseClientOptions) {
  const config = parseDatabaseConfig(options);
  const pool = new Pool({
    connectionString: config.connectionString,
    max: config.maxConnections,
  });
  const db = drizzle({ client: pool });

  return {
    db,
    close: () => pool.end(),
  };
}

export type DatabaseClient = ReturnType<typeof createDatabaseClient>;

export async function checkDatabaseConnection(
  client: DatabaseClient,
): Promise<void> {
  await client.db.execute(sql`select 1`);
}
