import {
  checkDatabaseConnection,
  createDatabaseClient,
} from "./client.js";

const client = createDatabaseClient({
  connectionString: process.env.DATABASE_URL,
  maxConnections: 1,
});

try {
  await checkDatabaseConnection(client);
  process.stdout.write("Database connection succeeded\n");
} finally {
  await client.close();
}
