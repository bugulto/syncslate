export type UserAuthPrincipal = {
  kind: "user";
  userId: string;
  participantId?: string;
};

export type AuthPrincipal = UserAuthPrincipal;
