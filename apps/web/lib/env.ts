import { z } from "zod";

const webEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.url().transform((url) => url.replace(/\/+$/, "")),
  NEXT_PUBLIC_SUPABASE_URL: z.url().transform((url) => url.replace(/\/+$/, "")),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().trim().min(1),
});

export type WebEnv = z.infer<typeof webEnvSchema>;

export function parseWebEnv(input: Record<string, string | undefined>): WebEnv {
  const result = webEnvSchema.safeParse(input);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => {
        const path = issue.path.join(".") || "environment";
        return `${path}: ${issue.message}`;
      })
      .join("; ");

    throw new Error(`Invalid web environment: ${details}`);
  }

  return result.data;
}

export function getWebEnv(): WebEnv {
  return parseWebEnv({
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}
