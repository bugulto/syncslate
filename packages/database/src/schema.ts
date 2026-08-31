import {
  type ProblemExample,
  editingPolicyValues,
  problemDifficultyValues,
  problemVisibilityValues,
  sessionStatusValues,
  supportedLanguageValues,
} from "@syncslate/contracts";
import {
  index,
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
    unique("problem_starter_code_problem_id_language_unique").on(
      table.problemId,
      table.language,
    ),
    index("problem_starter_code_problem_id_idx").on(table.problemId),
  ],
);

export type ProblemStarterCode = typeof problemStarterCode.$inferSelect;
export type NewProblemStarterCode = typeof problemStarterCode.$inferInsert;
