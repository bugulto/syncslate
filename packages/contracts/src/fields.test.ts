import { describe, expect, it } from "vitest";

import {
  durationSecondsSchema,
  resultLimitSchema,
  searchQuerySchema,
  tagsSchema,
  titleSchema,
  utcDateTimeSchema,
  uuidSchema,
} from "./fields.js";

describe("shared text fields", () => {
  it("trims valid titles and search queries", () => {
    expect(titleSchema.parse("  Backend interview  ")).toBe(
      "Backend interview",
    );
    expect(searchQuerySchema.parse("  binary tree  ")).toBe("binary tree");
  });

  it("rejects blank or oversized text", () => {
    expect(titleSchema.safeParse("   ").success).toBe(false);
    expect(titleSchema.safeParse("A".repeat(121)).success).toBe(false);
    expect(searchQuerySchema.safeParse("   ").success).toBe(false);
    expect(searchQuerySchema.safeParse("A".repeat(101)).success).toBe(false);
  });
});

describe("shared identity and timestamp fields", () => {
  it("accepts UUIDs and UTC ISO timestamps", () => {
    expect(
      uuidSchema.safeParse("550e8400-e29b-41d4-a716-446655440000").success,
    ).toBe(true);
    expect(
      utcDateTimeSchema.safeParse("2026-08-31T12:15:30.000Z").success,
    ).toBe(true);
  });

  it("rejects malformed UUIDs and non-UTC timestamps", () => {
    expect(uuidSchema.safeParse("not-a-uuid").success).toBe(false);
    expect(
      utcDateTimeSchema.safeParse("2026-08-31T18:00:30+05:45").success,
    ).toBe(false);
    expect(utcDateTimeSchema.safeParse("2026-08-31 12:15:30").success).toBe(
      false,
    );
  });
});

describe("shared collection and numeric fields", () => {
  it("trims unique tags", () => {
    expect(tagsSchema.parse([" arrays ", "dynamic programming"])).toEqual([
      "arrays",
      "dynamic programming",
    ]);
  });

  it("rejects duplicate tags regardless of casing", () => {
    expect(tagsSchema.safeParse(["Arrays", "arrays"]).success).toBe(false);
  });

  it("accepts bounded whole-number durations and result limits", () => {
    expect(durationSecondsSchema.parse(45 * 60)).toBe(2700);
    expect(resultLimitSchema.parse(20)).toBe(20);
  });

  it("rejects out-of-range or fractional numeric values", () => {
    expect(durationSecondsSchema.safeParse(299).success).toBe(false);
    expect(durationSecondsSchema.safeParse(3 * 60 * 60 + 1).success).toBe(
      false,
    );
    expect(durationSecondsSchema.safeParse(600.5).success).toBe(false);
    expect(resultLimitSchema.safeParse(0).success).toBe(false);
    expect(resultLimitSchema.safeParse(101).success).toBe(false);
    expect(resultLimitSchema.safeParse(10.5).success).toBe(false);
  });
});
