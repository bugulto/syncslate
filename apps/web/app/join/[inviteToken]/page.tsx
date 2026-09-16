import { rawInvitationTokenSchema } from "@syncslate/contracts";
import { notFound } from "next/navigation";

import { CandidateWaitingRoom } from "../../../features/invitations/candidate-waiting-room";

type JoinPageProps = {
  params: Promise<{ inviteToken: string }>;
};

export default async function JoinPage({ params }: JoinPageProps) {
  const paramsResult = rawInvitationTokenSchema.safeParse(
    (await params).inviteToken,
  );

  if (!paramsResult.success) {
    notFound();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-slate-100 sm:px-6">
      <CandidateWaitingRoom inviteToken={paramsResult.data} />
    </main>
  );
}
