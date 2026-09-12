import {
  admitCandidateByTokenHash,
  checkDatabaseConnection,
  createDatabaseClient,
  createInvitationForOwnedSession,
  createProfileIfMissing,
  createSession,
  findSessionByIdForInterviewer,
  findInvitationPreviewByTokenHash,
  findVisibleProblemById,
  findProfileByUserId,
  listSessionsByInterviewer,
  revokeInvitationForOwnedSession,
  searchVisibleProblems,
  updateProfileMetadata,
} from "@syncslate/database";

import { buildApp } from "./app.js";
import { parseApiEnv } from "./config/env.js";
import { createAccessTokenVerifier } from "./modules/auth/access-token-verifier.js";
import { createGuestTokenService } from "./modules/auth/guest-token.js";
import { createProfileBootstrapService } from "./modules/auth/profile-bootstrap.js";
import { createSupabaseAuthClient } from "./modules/auth/supabase-auth.js";
import {
  createInvitationCreationService,
  createInvitationInspectionService,
  createInvitationJoinService,
  createInvitationRevocationService,
} from "./modules/invitations/invitation.service.js";
import { createSessionCreationService } from "./modules/sessions/session.service.js";

const env = parseApiEnv(process.env);
const database = createDatabaseClient({
  connectionString: env.DATABASE_URL,
});
const supabase = createSupabaseAuthClient({
  url: env.SUPABASE_URL,
  anonKey: env.SUPABASE_ANON_KEY,
});
const verifyAccessToken = createAccessTokenVerifier(supabase);
const bootstrapProfile = createProfileBootstrapService({
  findProfileByUserId: (userId) => findProfileByUserId(database, userId),
  createProfileIfMissing: (input) => createProfileIfMissing(database, input),
  updateProfileMetadata: (input) => updateProfileMetadata(database, input),
});
const createWaitingSession = createSessionCreationService({
  createSession: (input) => createSession(database, input),
  findVisibleProblemById: (input) => findVisibleProblemById(database, input),
});
const createInvitation = createInvitationCreationService({
  createInvitationForOwnedSession: (input) =>
    createInvitationForOwnedSession(database, input),
  tokenPepper: env.INVITE_TOKEN_PEPPER,
});
const guestTokens = createGuestTokenService({
  secret: env.GUEST_JWT_SECRET,
  ttlSeconds: env.GUEST_JWT_TTL_SECONDS,
});
const inspectInvitation = createInvitationInspectionService({
  findInvitationPreviewByTokenHash: (input) =>
    findInvitationPreviewByTokenHash(database, input),
  tokenPepper: env.INVITE_TOKEN_PEPPER,
});
const joinInvitation = createInvitationJoinService({
  admitCandidateByTokenHash: (input) =>
    admitCandidateByTokenHash(database, input),
  issueGuestToken: guestTokens.issue,
  tokenPepper: env.INVITE_TOKEN_PEPPER,
});
const revokeInvitation = createInvitationRevocationService({
  revokeInvitationForOwnedSession: (input) =>
    revokeInvitationForOwnedSession(database, input),
});
const app = buildApp({
  logger: {
    level: env.LOG_LEVEL,
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "res.headers.set-cookie",
      ],
      censor: "[REDACTED]",
    },
  },
  corsAllowedOrigins: env.CORS_ALLOWED_ORIGINS,
  checkReadiness: () => checkDatabaseConnection(database),
  bootstrapProfile,
  createInvitation,
  inspectInvitation,
  joinInvitation,
  createWaitingSession,
  findSessionByIdForInterviewer: (input) =>
    findSessionByIdForInterviewer(database, input),
  findVisibleProblemById: (input) => findVisibleProblemById(database, input),
  listSessionsByInterviewer: (input) =>
    listSessionsByInterviewer(database, input),
  searchVisibleProblems: (input) => searchVisibleProblems(database, input),
  revokeInvitation,
  verifyAccessToken,
});

app.addHook("onClose", async () => {
  await database.close();
});

let isShuttingDown = false;

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  app.log.info({ signal }, "Shutting down API");

  try {
    await app.close();
  } catch (error) {
    app.log.error(error, "API shutdown failed");
    process.exitCode = 1;
  }
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

try {
  await app.listen({ host: env.HOST, port: env.PORT });
} catch (error) {
  app.log.error(error);
  await app.close();
  process.exitCode = 1;
}
