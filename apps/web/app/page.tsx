import Link from "next/link";

import { ApiHealthStatus } from "./api-health-status";
import { getWebEnv } from "../lib/env";
import { createClient } from "../lib/supabase/server";

export default async function HomePage() {
  const env = getWebEnv();
  let isAuthenticated = false;

  try {
    const supabase = await createClient(env);
    const { data, error } = await supabase.auth.getClaims();

    isAuthenticated = error === null && Boolean(data?.claims);
  } catch {
    // A failed session lookup should not prevent access to the public landing page.
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-6 py-16 text-slate-100">
      <section
        aria-labelledby="landing-title"
        className="mx-auto max-w-2xl text-center"
      >
        <p className="mb-4 text-sm font-semibold tracking-widest text-cyan-300 uppercase">
          Interview collaboration
        </p>
        <h1
          id="landing-title"
          className="text-5xl font-bold tracking-tight sm:text-6xl"
        >
          SyncSlate
        </h1>
        <p className="mt-6 text-lg leading-8 text-slate-300">
          Real-time technical interviews, in one focused workspace.
        </p>
        <Link
          className="mt-8 inline-flex rounded-lg bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300"
          href={isAuthenticated ? "/dashboard" : "/sign-in"}
        >
          {isAuthenticated ? "Go to dashboard" : "Sign in"}
        </Link>
        <ApiHealthStatus apiUrl={env.NEXT_PUBLIC_API_URL} />
      </section>
    </main>
  );
}
