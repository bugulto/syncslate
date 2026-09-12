import { postgresConnectionStringSchema } from "@syncslate/database";
import { z } from "zod";

const apiEnvSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    HOST: z.string().trim().min(1).default("0.0.0.0"),
    PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    CORS_ALLOWED_ORIGINS: z
      .string()
      .default("http://localhost:3000")
      .transform((value) => value.split(",").map((origin) => origin.trim()))
      .pipe(z.array(z.url()).min(1)),
    DATABASE_URL: postgresConnectionStringSchema,
    SUPABASE_URL: z.url().transform((url) => url.replace(/\/+$/, "")),
    SUPABASE_ANON_KEY: z.string().trim().min(1),
    INVITE_TOKEN_PEPPER: z
      .string()
      .trim()
      .min(32, "Must contain at least 32 characters"),
    GUEST_JWT_SECRET: z
      .string()
      .trim()
      .min(32, "Must contain at least 32 characters"),
    GUEST_JWT_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(300)
      .max(86_400)
      .default(1_800),
  })
  .superRefine((environment, context) => {
    if (environment.GUEST_JWT_SECRET === environment.INVITE_TOKEN_PEPPER) {
      context.addIssue({
        code: "custom",
        message: "Must differ from INVITE_TOKEN_PEPPER",
        path: ["GUEST_JWT_SECRET"],
      });
    }
  });

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export function parseApiEnv(input: Record<string, string | undefined>): ApiEnv {
  const result = apiEnvSchema.safeParse(input);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => {
        const path = issue.path.join(".") || "environment";
        return `${path}: ${issue.message}`;
      })
      .join("; ");

    throw new Error(`Invalid API environment: ${details}`);
  }

  return result.data;
}
