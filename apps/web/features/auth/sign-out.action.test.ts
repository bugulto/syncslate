import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, redirect, revalidatePath, signOut } = vi.hoisted(() => ({
  createClient: vi.fn(),
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("../../lib/supabase/server", () => ({ createClient }));

import { signOutAction } from "./sign-out.action";

const initialState = { error: null };

describe("signOutAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClient.mockResolvedValue({ auth: { signOut } });
    signOut.mockResolvedValue({ error: null });
    redirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
  });

  it("signs out, invalidates authenticated data, and redirects", async () => {
    await expect(signOutAction(initialState)).rejects.toThrow("NEXT_REDIRECT");

    expect(createClient).toHaveBeenCalledOnce();
    expect(signOut).toHaveBeenCalledOnce();
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
    expect(redirect).toHaveBeenCalledWith("/sign-in");
  });

  it("returns a safe error when Supabase rejects sign-out", async () => {
    signOut.mockResolvedValue({
      error: new Error("sensitive Supabase failure"),
    });

    await expect(signOutAction(initialState)).resolves.toEqual({
      error: "Unable to sign out. Please try again.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("returns a safe error when the server client fails", async () => {
    createClient.mockRejectedValue(new Error("sensitive cookie failure"));

    await expect(signOutAction(initialState)).resolves.toEqual({
      error: "Unable to sign out. Please try again.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });
});
