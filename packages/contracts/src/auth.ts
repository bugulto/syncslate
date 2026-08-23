import { z } from "zod";

export const currentUserSchema = z
  .object({
    id: z.uuid(),
    email: z.email().nullable(),
    displayName: z.string().trim().min(3).max(20),
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
