import type { UserAuthPrincipal } from "./auth-principal.js";

export type AuthenticatedUser = {
  principal: UserAuthPrincipal;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
};
