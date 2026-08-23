import type { AuthPrincipal } from "./auth-principal.js";

export type AuthenticatedUser = {
  principal: AuthPrincipal;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
};
