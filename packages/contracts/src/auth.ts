import { z } from "zod";

export const displayNameSchema = z
  .string()
  .trim()
  .min(3, "Display name must be at least 3 characters")
  .max(20, "Display name must be 20 characters or fewer");

export const currentUserSchema = z
  .object({
    id: z.uuid(),
    email: z.email().nullable(),
    displayName: displayNameSchema,
    avatarUrl: z.url().nullable(),
  })
  .strict();

export type CurrentUser = z.infer<typeof currentUserSchema>;

export const meResponseSchema = z
  .object({
    user: currentUserSchema,
  })
  .strict();

export type MeResponse = z.infer<typeof meResponseSchema>;
