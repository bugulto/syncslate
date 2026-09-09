export type UserAuthPrincipal = {
  kind: "user";
  userId: string;
  participantId?: string;
};

export type GuestAuthPrincipal = {
  kind: "guest";
  participantId: string;
  sessionId: string;
  role: "candidate";
};

export type AuthPrincipal = UserAuthPrincipal | GuestAuthPrincipal;

export function isUserAuthPrincipal(
  principal: AuthPrincipal | null,
): principal is UserAuthPrincipal {
  return principal?.kind === "user";
}
