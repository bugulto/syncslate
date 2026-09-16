"use client";

import { getWebEnv } from "../env";
import { createClient as createSupabaseClient } from "../supabase/client";
import {
  createAuthenticatedApiClient,
  createPublicApiClient,
  type AuthenticatedApiClient,
  type PublicApiClient,
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

export function createPublicBrowserApiClient(): PublicApiClient {
  const env = getWebEnv();

  return createPublicApiClient({
    baseUrl: env.NEXT_PUBLIC_API_URL,
    fetch: globalThis.fetch.bind(globalThis),
  });
}
