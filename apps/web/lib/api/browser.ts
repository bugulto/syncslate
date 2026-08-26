"use client";

import { getWebEnv } from "../env";
import { createClient as createSupabaseClient } from "../supabase/client";
import {
  createAuthenticatedApiClient,
  type AuthenticatedApiClient,
} from "./client";
import { getSupabaseAccessToken } from "./supabase-access-token";

export function createBrowserApiClient(): AuthenticatedApiClient {
  const env = getWebEnv();
  const supabase = createSupabaseClient(env);

  return createAuthenticatedApiClient({
    baseUrl: env.NEXT_PUBLIC_API_URL,
    getAccessToken: () => getSupabaseAccessToken(supabase),
    fetch: globalThis.fetch.bind(globalThis),
  });
}
