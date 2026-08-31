import {
  editingPolicyValues,
  problemDifficultyValues,
  problemVisibilityValues,
  sessionStatusValues,
  supportedLanguageValues,
} from "@syncslate/contracts";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  editingPolicyEnum,
  interviewSessions,
  problemDifficultyEnum,
  problems,
  problemStarterCode,
  problemVisibilityEnum,
  programmingLanguageEnum,
  sessionInvitations,
  sessionStatusEnum,
} from "./schema.js";

describe("database enums", () => {
  it.each([
    [problemVisibilityEnum, "problem_visibility", problemVisibilityValues],
    [problemDifficultyEnum, "problem_difficulty", problemDifficultyValues],
    [programmingLanguageEnum, "programming_language", supportedLanguageValues],
    [sessionStatusEnum, "session_status", sessionStatusValues],
    [editingPolicyEnum, "editing_policy", editingPolicyValues],
  ] as const)(
    "maps shared values to the %s PostgreSQL enum",
    (databaseEnum, enumName, sharedValues) => {
      expect(databaseEnum.enumName).toBe(enumName);
      expect(databaseEnum.enumValues).toEqual(sharedValues);
    },
  );
});

describe("problems table", () => {
  it("defines required columns and generated identifiers", () => {
    const config = getTableConfig(problems);

    expect(config.name).toBe("problems");
    expect(problems.id.hasDefault).toBe(true);
    expect(problems.ownerId.notNull).toBe(false);
    expect(problems.visibility.enumValues).toEqual(problemVisibilityValues);
    expect(problems.difficulty.enumValues).toEqual(problemDifficultyValues);
    expect(problems.tags.notNull).toBe(true);
    expect(problems.examples.notNull).toBe(true);
  });

  it("indexes ownership and problem filters", () => {
    const { indexes } = getTableConfig(problems);

    expect(indexes.map((databaseIndex) => databaseIndex.config.name)).toEqual(
      expect.arrayContaining([
        "problems_owner_id_idx",
        "problems_visibility_idx",
        "problems_difficulty_idx",
        "problems_tags_idx",
        "problems_slug_idx",
      ]),
    );
    expect(
      indexes.find(
        (databaseIndex) => databaseIndex.config.name === "problems_tags_idx",
      )?.config.method,
    ).toBe("gin");
  });

  it("deletes private problems with their owning profile", () => {
    const ownerForeignKey = getTableConfig(problems).foreignKeys.find(
      (foreignKey) => foreignKey.reference().columns[0]?.name === "owner_id",
    );

    expect(ownerForeignKey?.reference().foreignTable).toBeDefined();
    expect(ownerForeignKey?.onDelete).toBe("cascade");
  });

  it("enforces ownership and non-blank problem fields", () => {
    expect(
      getTableConfig(problems).checks.map((constraint) => constraint.name),
    ).toEqual(
      expect.arrayContaining([
        "problems_visibility_owner_check",
        "problems_title_not_blank_check",
        "problems_slug_not_blank_check",
      ]),
    );
  });
});

describe("problem starter-code table", () => {
  it("requires one language-specific code value per row", () => {
    const config = getTableConfig(problemStarterCode);

    expect(config.name).toBe("problem_starter_code");
    expect(problemStarterCode.id.hasDefault).toBe(true);
    expect(problemStarterCode.problemId.notNull).toBe(true);
    expect(problemStarterCode.language.enumValues).toEqual(
      supportedLanguageValues,
    );
    expect(problemStarterCode.code.notNull).toBe(true);
  });

  it("enforces unique language entries and indexed problem lookup", () => {
    const config = getTableConfig(problemStarterCode);
    const languageConstraint = config.uniqueConstraints.find(
      (constraint) =>
        constraint.getName() ===
        "problem_starter_code_problem_id_language_unique",
    );

    expect(languageConstraint?.columns.map((column) => column.name)).toEqual([
      "problem_id",
      "language",
    ]);
    expect(
      config.indexes.map((databaseIndex) => databaseIndex.config.name),
    ).toContain("problem_starter_code_problem_id_idx");
  });

  it("cascades starter-code deletion with its problem", () => {
    const problemForeignKey = getTableConfig(
      problemStarterCode,
    ).foreignKeys.find(
      (foreignKey) => foreignKey.reference().columns[0]?.name === "problem_id",
    );

    expect(problemForeignKey?.onDelete).toBe("cascade");
  });

  it("rejects empty starter code", () => {
    expect(
      getTableConfig(problemStarterCode).checks.map(
        (constraint) => constraint.name,
      ),
    ).toContain("problem_starter_code_code_not_blank_check");
  });
});

describe("interview sessions table", () => {
  it("defines authoritative waiting-session state", () => {
    const config = getTableConfig(interviewSessions);

    expect(config.name).toBe("interview_sessions");
    expect(interviewSessions.id.hasDefault).toBe(true);
    expect(interviewSessions.interviewerId.notNull).toBe(true);
    expect(interviewSessions.problemId.notNull).toBe(false);
    expect(interviewSessions.status.enumValues).toEqual(sessionStatusValues);
    expect(interviewSessions.status.hasDefault).toBe(true);
    expect(interviewSessions.language.enumValues).toEqual(
      supportedLanguageValues,
    );
    expect(interviewSessions.editingPolicy.enumValues).toEqual(
      editingPolicyValues,
    );
    expect(interviewSessions.editingPolicy.hasDefault).toBe(true);
    expect(interviewSessions.timerState.notNull).toBe(true);
  });

  it("preserves ownership while allowing deleted problems", () => {
    const foreignKeys = getTableConfig(interviewSessions).foreignKeys;
    const interviewerForeignKey = foreignKeys.find(
      (foreignKey) =>
        foreignKey.reference().columns[0]?.name === "interviewer_id",
    );
    const problemForeignKey = foreignKeys.find(
      (foreignKey) => foreignKey.reference().columns[0]?.name === "problem_id",
    );

    expect(interviewerForeignKey?.onDelete).toBe("cascade");
    expect(problemForeignKey?.onDelete).toBe("set null");
  });

  it("indexes owner history and enforces valid input", () => {
    const config = getTableConfig(interviewSessions);

    expect(
      config.indexes.map((databaseIndex) => databaseIndex.config.name),
    ).toContain("interview_sessions_interviewer_id_created_at_idx");
    expect(config.checks.map((constraint) => constraint.name)).toEqual(
      expect.arrayContaining([
        "interview_sessions_title_not_blank_check",
        "interview_sessions_duration_seconds_check",
      ]),
    );
  });
});

describe("session invitations table", () => {
  it("stores only required invitation lifecycle data", () => {
    const config = getTableConfig(sessionInvitations);

    expect(config.name).toBe("session_invitations");
    expect(sessionInvitations.id.hasDefault).toBe(true);
    expect(sessionInvitations.sessionId.notNull).toBe(true);
    expect(sessionInvitations.tokenHash.notNull).toBe(true);
    expect(sessionInvitations.expiresAt.notNull).toBe(true);
    expect(sessionInvitations.consumedAt.notNull).toBe(false);
    expect(sessionInvitations.revokedAt.notNull).toBe(false);
    expect("rawToken" in sessionInvitations).toBe(false);
  });

  it("enforces unique hashes and indexes session lookup", () => {
    const config = getTableConfig(sessionInvitations);
    const tokenHashConstraint = config.uniqueConstraints.find(
      (constraint) =>
        constraint.getName() === "session_invitations_token_hash_unique",
    );

    expect(tokenHashConstraint?.columns.map((column) => column.name)).toEqual([
      "token_hash",
    ]);
    expect(
      config.indexes.map((databaseIndex) => databaseIndex.config.name),
    ).toContain("session_invitations_session_id_idx");
  });

  it("cascades with sessions and validates token lifecycle fields", () => {
    const config = getTableConfig(sessionInvitations);
    const sessionForeignKey = config.foreignKeys.find(
      (foreignKey) => foreignKey.reference().columns[0]?.name === "session_id",
    );

    expect(sessionForeignKey?.onDelete).toBe("cascade");
    expect(config.checks.map((constraint) => constraint.name)).toEqual(
      expect.arrayContaining([
        "session_invitations_token_hash_not_blank_check",
        "session_invitations_expires_after_creation_check",
      ]),
    );
  });
});
