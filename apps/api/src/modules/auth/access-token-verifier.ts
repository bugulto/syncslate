import type { AuthPrincipal } from "./auth-principal.js";

type SupabaseUserVerifier = {
  auth: {
    getUser: (accessToken: string) => Promise<{
      data: { user: { id: string } | null };
      error: unknown;
    }>;
  };
};

export type AccessTokenVerifier = (
  accessToken: string,
) => Promise<AuthPrincipal | null>;

export function createAccessTokenVerifier(
  supabase: SupabaseUserVerifier,
): AccessTokenVerifier {
  return async (accessToken) => {
    try {
      const { data, error } = await supabase.auth.getUser(accessToken);

      if (error || !data.user) {
        return null;
      }

      return {
        kind: "user",
        userId: data.user.id,
      };
    } catch {
      return null;
    }
  };
}
