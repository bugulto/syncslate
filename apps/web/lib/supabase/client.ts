import { createBrowserClient } from "@supabase/ssr";

import { getWebEnv, type WebEnv } from "../env";

export function createClient(env: WebEnv = getWebEnv()) {
  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
