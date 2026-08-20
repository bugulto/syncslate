import { createClient } from "@supabase/supabase-js";

export type SupabaseAuthClientConfig = {
  url: string;
  anonKey: string;
};

export function createSupabaseAuthClient(config: SupabaseAuthClientConfig) {
  return createClient(config.url, config.anonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

export type SupabaseAuthClient = ReturnType<typeof createSupabaseAuthClient>;
