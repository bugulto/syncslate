import Link from "next/link";

import { AuthForm } from "../../features/auth/auth-form";

type SignInPageProps = {
  searchParams: Promise<{
    error?: string | string[];
  }>;
};

const callbackErrorMessage =
  "Authentication could not be completed. Please try again.";

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { error } = await searchParams;
  const initialError =
    error === "auth_callback_failed" ? callbackErrorMessage : undefined;

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-6 py-12 text-slate-100">
      <div className="flex w-full flex-col items-center gap-8">
        <Link
          href="/"
          className="text-xl font-bold tracking-tight text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300"
        >
          SyncSlate
        </Link>
        <AuthForm {...(initialError ? { initialError } : {})} />
      </div>
    </main>
  );
}
