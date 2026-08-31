import {
  type ProblemExample,
  editingPolicyValues,
  problemDifficultyValues,
  problemVisibilityValues,
  sessionStatusValues,
  supportedLanguageValues,
} from "@syncslate/contracts";
import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgSchema,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const problemVisibilityEnum = pgEnum(
  "problem_visibility",
  problemVisibilityValues,
);

export const problemDifficultyEnum = pgEnum(
  "problem_difficulty",
  problemDifficultyValues,
);

export const programmingLanguageEnum = pgEnum(
  "programming_language",
  supportedLanguageValues,
);

export const sessionStatusEnum = pgEnum("session_status", sessionStatusValues);

export const editingPolicyEnum = pgEnum("editing_policy", editingPolicyValues);

const authSchema = pgSchema("auth");

// Reference-only definition for the Supabase-managed auth.users table.
// It is intentionally not exported so Drizzle Kit does not manage it.
const authUsers = authSchema.table("users", {
  id: uuid("id").primaryKey(),
});

export const profiles = pgTable("profiles", {
  id: uuid("id")
    .primaryKey()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;

export const problems = pgTable(
  "problems",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("owner_id").references(() => profiles.id, {
      onDelete: "cascade",
    }),
    visibility: problemVisibilityEnum("visibility").notNull(),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    descriptionMarkdown: text("description_markdown").notNull(),
    difficulty: problemDifficultyEnum("difficulty").notNull(),
    tags: text("tags").array().notNull(),
    constraintsMarkdown: text("constraints_markdown"),
    examples: jsonb("examples").$type<ProblemExample[]>().notNull(),
    interviewerNotesMarkdown: text("interviewer_notes_markdown"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "problems_visibility_owner_check",
      sql`(
        (${table.visibility} = 'seeded' and ${table.ownerId} is null)
        or (${table.visibility} = 'private' and ${table.ownerId} is not null)
      )`,
    ),
    check(
      "problems_title_not_blank_check",
      sql`length(btrim(${table.title})) > 0`,
    ),
    check(
      "problems_slug_not_blank_check",
      sql`length(btrim(${table.slug})) > 0`,
    ),
    index("problems_owner_id_idx").on(table.ownerId),
    index("problems_visibility_idx").on(table.visibility),
    index("problems_difficulty_idx").on(table.difficulty),
    index("problems_tags_idx").using("gin", table.tags),
    index("problems_slug_idx").on(table.slug),
  ],
);

export type Problem = typeof problems.$inferSelect;
export type NewProblem = typeof problems.$inferInsert;

export const problemStarterCode = pgTable(
  "problem_starter_code",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    problemId: uuid("problem_id")
      .notNull()
      .references(() => problems.id, { onDelete: "cascade" }),
    language: programmingLanguageEnum("language").notNull(),
    code: text("code").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "problem_starter_code_code_not_blank_check",
      sql`length(${table.code}) > 0`,
    ),
    unique("problem_starter_code_problem_id_language_unique").on(
      table.problemId,
      table.language,
    ),
    index("problem_starter_code_problem_id_idx").on(table.problemId),
  ],
);

export type ProblemStarterCode = typeof problemStarterCode.$inferSelect;
export type NewProblemStarterCode = typeof problemStarterCode.$inferInsert;

export const interviewSessions = pgTable(
  "interview_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    interviewerId: uuid("interviewer_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    problemId: uuid("problem_id").references(() => problems.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    status: sessionStatusEnum("status").default("waiting").notNull(),
    language: programmingLanguageEnum("language").notNull(),
    editingPolicy: editingPolicyEnum("editing_policy")
      .default("candidate_only")
      .notNull(),
    durationSeconds: integer("duration_seconds").notNull(),
    startedAt: timestamp("started_at", { mode: "date", withTimezone: true }),
    endedAt: timestamp("ended_at", { mode: "date", withTimezone: true }),
    timerState: jsonb("timer_state").notNull(),
    finalCode: text("final_code"),
    finalWhiteboard: jsonb("final_whiteboard"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "interview_sessions_title_not_blank_check",
      sql`length(btrim(${table.title})) > 0`,
    ),
    check(
      "interview_sessions_duration_seconds_check",
      sql`${table.durationSeconds} between 300 and 10800`,
    ),
    index("interview_sessions_interviewer_id_created_at_idx").on(
      table.interviewerId,
      table.createdAt,
    ),
  ],
);

export type InterviewSession = typeof interviewSessions.$inferSelect;
export type NewInterviewSession = typeof interviewSessions.$inferInsert;

export const sessionInvitations = pgTable(
  "session_invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => interviewSessions.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    consumedAt: timestamp("consumed_at", {
      mode: "date",
      withTimezone: true,
    }),
    revokedAt: timestamp("revoked_at", {
      mode: "date",
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "session_invitations_token_hash_not_blank_check",
      sql`length(btrim(${table.tokenHash})) > 0`,
    ),
    check(
      "session_invitations_expires_after_creation_check",
      sql`${table.expiresAt} > ${table.createdAt}`,
    ),
    unique("session_invitations_token_hash_unique").on(table.tokenHash),
    index("session_invitations_session_id_idx").on(table.sessionId),
  ],
);

export type SessionInvitation = typeof sessionInvitations.$inferSelect;
export type NewSessionInvitation = typeof sessionInvitations.$inferInsert;
