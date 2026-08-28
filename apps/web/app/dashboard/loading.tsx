export default function DashboardLoading() {
  return (
    <main
      aria-busy="true"
      className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100"
    >
      <section className="mx-auto max-w-5xl">
        <p className="text-sm font-semibold tracking-widest text-cyan-300 uppercase">
          Interviewer workspace
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">
          Dashboard
        </h1>

        <div
          aria-live="polite"
          className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/80 p-6"
          role="status"
        >
          <p className="font-semibold text-slate-100">Loading dashboard</p>
          <p className="mt-2 text-sm text-slate-400">
            Fetching your interviewer profile.
          </p>
        </div>
      </section>
    </main>
  );
}
