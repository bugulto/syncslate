type SupabaseSessionReader = {
  auth: {
    getSession: () => Promise<{
      data: {
        session: {
          access_token?: unknown;
        } | null;
      };
      error: unknown;
    }>;
  };
};

export async function getSupabaseAccessToken(
  supabase: SupabaseSessionReader,
): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      return null;
    }

    const accessToken = data.session?.access_token;

    if (
      typeof accessToken !== "string" ||
      accessToken.length === 0 ||
      accessToken.trim() !== accessToken
    ) {
      return null;
    }

    return accessToken;
  } catch {
    return null;
  }
}
