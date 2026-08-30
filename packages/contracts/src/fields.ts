import { z } from "zod";

const MAX_TITLE_LENGTH = 120;
const MAX_TAG_LENGTH = 32;
const MAX_TAGS = 10;
const MIN_DURATION_SECONDS = 5 * 60;
const MAX_DURATION_SECONDS = 3 * 60 * 60;
const MAX_SEARCH_QUERY_LENGTH = 100;
const MAX_RESULT_LIMIT = 100;

export const uuidSchema = z.uuid();

export const titleSchema = z
  .string()
  .trim()
  .min(1, "Title is required")
  .max(
    MAX_TITLE_LENGTH,
    `Title must be ${MAX_TITLE_LENGTH} characters or fewer`,
  );

export const utcDateTimeSchema = z.iso.datetime();

export const tagSchema = z
  .string()
  .trim()
  .min(1, "Tag cannot be empty")
  .max(MAX_TAG_LENGTH, `Tag must be ${MAX_TAG_LENGTH} characters or fewer`);

export const tagsSchema = z
  .array(tagSchema)
  .max(MAX_TAGS, `No more than ${MAX_TAGS} tags are allowed`)
  .refine(
    (tags) =>
      new Set(tags.map((tag) => tag.toLocaleLowerCase())).size === tags.length,
    "Tags must be unique",
  );

export const durationSecondsSchema = z
  .number()
  .int("Duration must be a whole number of seconds")
  .min(MIN_DURATION_SECONDS, "Duration must be at least 5 minutes")
  .max(MAX_DURATION_SECONDS, "Duration must be no more than 3 hours");

export const searchQuerySchema = z
  .string()
  .trim()
  .min(1, "Search query cannot be empty")
  .max(
    MAX_SEARCH_QUERY_LENGTH,
    `Search query must be ${MAX_SEARCH_QUERY_LENGTH} characters or fewer`,
  );

export const resultLimitSchema = z
  .number()
  .int("Result limit must be a whole number")
  .min(1, "Result limit must be at least 1")
  .max(
    MAX_RESULT_LIMIT,
    `Result limit must be no more than ${MAX_RESULT_LIMIT}`,
  );
