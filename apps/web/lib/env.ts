import { z } from "zod";

const webEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.url().transform((url) => url.replace(/\/+$/, "")),
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
