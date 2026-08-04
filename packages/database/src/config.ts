import { z } from "zod";

export const postgresConnectionStringSchema = z
  .string()
  .trim()
  .url()
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "postgres:" || protocol === "postgresql:";
  }, "Must be a PostgreSQL connection URL");

const databaseConfigSchema = z.object({
  connectionString: postgresConnectionStringSchema,
  maxConnections: z.number().int().min(1).max(20).default(10),
});

export type DatabaseConfig = z.infer<typeof databaseConfigSchema>;

export function parseDatabaseConfig(input: {
  connectionString: string | undefined;
  maxConnections?: number;
}): DatabaseConfig {
  const result = databaseConfigSchema.safeParse(input);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => {
        const path = issue.path.join(".") || "database";
        return `${path}: ${issue.message}`;
      })
      .join("; ");

    throw new Error(`Invalid database configuration: ${details}`);
  }

  return result.data;
}
