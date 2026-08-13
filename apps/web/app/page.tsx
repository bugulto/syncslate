import { ApiHealthStatus } from "./api-health-status";
import { parseWebEnv } from "../lib/env";

export default function HomePage() {
  const env = parseWebEnv({
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

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
        <ApiHealthStatus apiUrl={env.NEXT_PUBLIC_API_URL} />
      </section>
    </main>
  );
}
