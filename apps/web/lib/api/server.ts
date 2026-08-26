import { getWebEnv } from "../env";
import { createClient as createSupabaseClient } from "../supabase/server";
import {
  createAuthenticatedApiClient,
  type AuthenticatedApiClient,
} from "./client";
import { getSupabaseAccessToken } from "./supabase-access-token";

export async function createServerApiClient(): Promise<AuthenticatedApiClient> {
  const env = getWebEnv();
  const supabase = await createSupabaseClient(env);

  return createAuthenticatedApiClient({
    baseUrl: env.NEXT_PUBLIC_API_URL,
    getAccessToken: () => getSupabaseAccessToken(supabase),
    fetch: globalThis.fetch.bind(globalThis),
  });
}
