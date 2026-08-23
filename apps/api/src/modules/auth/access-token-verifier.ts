import { z } from "zod";

import type { AuthenticatedUser } from "./authenticated-user.js";

const userIdSchema = z.uuid();
const emailSchema = z.email();
const displayNameSchema = z.string().trim().min(3).max(20);
const avatarUrlSchema = z.url();

type SupabaseUserVerifier = {
  auth: {
    getUser: (accessToken: string) => Promise<{
      data: {
        user: {
          id: string;
          email?: string;
          user_metadata?: Record<string, unknown>;
        } | null;
      };
      error: unknown;
    }>;
  };
};

export type AccessTokenVerifier = (
  accessToken: string,
) => Promise<AuthenticatedUser | null>;

function normalizedValue<T>(schema: z.ZodType<T>, value: unknown): T | null {
  const result = schema.safeParse(value);

  return result.success ? result.data : null;
}

export function createAccessTokenVerifier(
  supabase: SupabaseUserVerifier,
): AccessTokenVerifier {
  return async (accessToken) => {
    try {
      const { data, error } = await supabase.auth.getUser(accessToken);

      if (error || !data.user) {
        return null;
      }

      const userId = normalizedValue(userIdSchema, data.user.id);

      if (!userId) {
        return null;
      }

      return {
        principal: {
          kind: "user",
          userId,
        },
        email: normalizedValue(emailSchema, data.user.email),
        displayName: normalizedValue(
          displayNameSchema,
          data.user.user_metadata?.display_name,
        ),
        avatarUrl: normalizedValue(
          avatarUrlSchema,
          data.user.user_metadata?.avatar_url,
        ),
      };
    } catch {
      return null;
    }
  };
}
