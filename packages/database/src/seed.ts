import { createDatabaseClient } from "./client.js";
import { seedProblems } from "./seed/seed-problems.js";

const directDatabaseUrl = process.env.DIRECT_DATABASE_URL?.trim();
const client = createDatabaseClient({
  connectionString: directDatabaseUrl || process.env.DATABASE_URL,
  maxConnections: 1,
});

try {
  const result = await seedProblems(client.db);

  process.stdout.write(
    `Seeded ${result.problemCount} problems and ${result.starterCodeCount} starter-code entries\n`,
  );
} finally {
  await client.close();
}
