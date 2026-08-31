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
  problemDifficultyEnum,
  problems,
  problemStarterCode,
  problemVisibilityEnum,
  programmingLanguageEnum,
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
});
