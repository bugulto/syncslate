import { redirect } from "next/navigation";

import { createClient } from "../../lib/supabase/server";

export default async function DashboardPage() {
  let isAuthenticated = false;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();

    isAuthenticated = error === null && Boolean(data?.claims);
  } catch {
    // An unverifiable session must not be allowed to access the dashboard.
  }

  if (!isAuthenticated) {
    redirect("/sign-in");
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <section aria-labelledby="dashboard-title" className="mx-auto max-w-5xl">
        <p className="text-sm font-semibold tracking-widest text-cyan-300 uppercase">
          Interviewer workspace
        </p>
        <h1
          id="dashboard-title"
          className="mt-3 text-3xl font-bold tracking-tight text-white"
        >
          Dashboard
        </h1>

        <div className="mt-10 rounded-2xl border border-dashed border-slate-700 bg-slate-900/60 px-6 py-12 text-center">
          <h2 className="text-lg font-semibold text-slate-100">
            No interview sessions yet
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Session creation and interview history will be added in a later
            milestone.
          </p>
        </div>
      </section>
    </main>
  );
}
