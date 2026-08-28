"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "../../lib/supabase/server";

export type SignOutActionState = {
  error: string | null;
};

const signOutErrorMessage = "Unable to sign out. Please try again.";

export async function signOutAction(
  previousState: SignOutActionState,
): Promise<SignOutActionState> {
  void previousState;

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      return { error: signOutErrorMessage };
    }
  } catch {
    return { error: signOutErrorMessage };
  }

  revalidatePath("/", "layout");
  redirect("/sign-in");
}
