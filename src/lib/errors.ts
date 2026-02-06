import { z } from "zod";
import type { $ZodError } from "zod/v4/core";

// AppErrors definition. Point of truth for all application errors.
// Important: Update constructors and HTTP mapping when adding new errors.
export const AppErrorSchema = z.discriminatedUnion("code", [
  z.object({ code: z.literal("NOTE_NOT_FOUND"), noteId: z.string() }),
  z.object({ code: z.literal("BLOCK_NOT_FOUND"), blockId: z.string() }),
  z.object({
    code: z.literal("RANK_EXHAUSTED"),
    prev: z.string().nullable(),
    next: z.string().nullable(),
  }),
  z.object({ code: z.literal("FORBIDDEN") }),
  z.object({ code: z.literal("DB_ERROR") }),
  z.object({ code: z.literal("VALIDATION_ERROR"), issues: z.custom<$ZodError["issues"]>() }),
  z.object({ code: z.literal("JSON_PARSE_ERROR"), message: z.unknown() }),
  z.object({ code: z.literal("JSON_EMPTY_BODY") }),
  z.object({ code: z.literal("UNSUPPORTED_CONTENT_TYPE"), contentType: z.string() }),
  z.object({ code: z.literal("CURSOR_PARSE_ERROR") }),
  z.object({ code: z.literal("RESPONSE_PARSE_ERROR"), status: z.number(), payload: z.unknown() }),
]);

export type AppError = z.infer<typeof AppErrorSchema>;
export type AppErrorCode = AppError["code"];

// Per-code constructor args for ergonomic error creation
type ErrorCtorArgs<K extends AppErrorCode> =
  // Add here when new error codes are added and need args
  K extends "NOTE_NOT_FOUND"
    ? [noteId: string]
    : K extends "BLOCK_NOT_FOUND"
      ? [blockId: string]
      : K extends "RANK_EXHAUSTED"
        ? [prev: string | null, next: string | null]
        : K extends "VALIDATION_ERROR"
          ? [issues: $ZodError["issues"]]
          : K extends "JSON_PARSE_ERROR"
            ? [message: unknown]
            : K extends "RESPONSE_PARSE_ERROR"
              ? [status: number, payload: unknown]
              : K extends "UNSUPPORTED_CONTENT_TYPE"
                ? [contentType: string]
                : [];

// Mapping of error codes to their constructors
type ErrorCtors = {
  [K in AppErrorCode]: (...args: ErrorCtorArgs<K>) => Extract<AppError, { code: K }>;
};

// Constructors to create AppErrors
export const Errors = {
  NOTE_NOT_FOUND: (noteId: string) => ({ code: "NOTE_NOT_FOUND", noteId }),
  BLOCK_NOT_FOUND: (blockId: string) => ({ code: "BLOCK_NOT_FOUND", blockId }),
  RANK_EXHAUSTED: (prev: string | null, next: string | null) => ({
    code: "RANK_EXHAUSTED",
    prev,
    next,
  }),
  FORBIDDEN: () => ({ code: "FORBIDDEN" }),
  DB_ERROR: () => ({ code: "DB_ERROR" }),
  VALIDATION_ERROR: (issues: $ZodError["issues"]) => ({ code: "VALIDATION_ERROR", issues }),
  JSON_PARSE_ERROR: (message: unknown) => ({ code: "JSON_PARSE_ERROR", message }),
  RESPONSE_PARSE_ERROR: (status: number, payload: unknown) => ({
    code: "RESPONSE_PARSE_ERROR",
    status,
    payload,
  }),
  UNSUPPORTED_CONTENT_TYPE: (contentType: string) => ({
    code: "UNSUPPORTED_CONTENT_TYPE",
    contentType,
  }),
  JSON_EMPTY_BODY: () => ({ code: "JSON_EMPTY_BODY" }),
  CURSOR_PARSE_ERROR: () => ({ code: "CURSOR_PARSE_ERROR" }),
} satisfies ErrorCtors;

// Type guard to check if an unknown value is an AppError
export function isAppError(x: unknown): x is AppError {
  return AppErrorSchema.safeParse(x).success;
}
