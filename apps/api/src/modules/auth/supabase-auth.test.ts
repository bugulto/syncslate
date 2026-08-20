import { createClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSupabaseAuthClient } from "./supabase-auth.js";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ kind: "supabase-auth-client" })),
}));

describe("createSupabaseAuthClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a server-only client with session persistence disabled", () => {
    const client = createSupabaseAuthClient({
      url: "https://project.supabase.co",
      anonKey: "test-anon-key",
    });

    expect(createClient).toHaveBeenCalledWith(
      "https://project.supabase.co",
      "test-anon-key",
      {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false,
        },
      },
    );
    expect(client).toEqual({ kind: "supabase-auth-client" });
  });
});
