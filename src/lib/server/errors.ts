import "server-only";
import { z } from "zod";
import type { $ZodError } from "zod/v4/core";

type HttpErrorMeta = {
  status: number;
  message?: string;
};

// AppErrors definition. Point of truth for all application errors.
// Important: Update constructors and HTTP mapping when adding new errors.
export const AppErrorSchema = z.discriminatedUnion("code", [
  z.object({ code: z.literal("NOTE_NOT_FOUND"), noteId: z.string() }),
  z.object({ code: z.literal("FORBIDDEN") }),
  z.object({ code: z.literal("DB_ERROR") }),
  z.object({ code: z.literal("VALIDATION_ERROR"), issues: z.custom<$ZodError["issues"]>() }),
  z.object({ code: z.literal("JSON_PARSE_ERROR"), message: z.unknown() }),
  z.object({ code: z.literal("JSON_EMPTY_BODY") }),
  z.object({ code: z.literal("UNSUPPORTED_CONTENT_TYPE"), contentType: z.string() }),
  z.object({ code: z.literal("CURSOR_PARSE_ERROR") }),
]);

export type AppError = z.infer<typeof AppErrorSchema>;
export type AppErrorCode = AppError["code"];

// Internal mapping of errors to HTTP responses.
const ERROR_HTTP_MAP = {
  NOTE_NOT_FOUND: { status: 404 },
  FORBIDDEN: { status: 403 },
  DB_ERROR: { status: 500 },
  VALIDATION_ERROR: { status: 400 },
  JSON_PARSE_ERROR: { status: 400 },
  JSON_EMPTY_BODY: { status: 400 },
  UNSUPPORTED_CONTENT_TYPE: { status: 415 },
  CURSOR_PARSE_ERROR: { status: 400 },
} satisfies Record<AppErrorCode, HttpErrorMeta>;

// Per-code constructor args for ergonomic error creation
type ErrorCtorArgs<K extends AppErrorCode> =
  // Add here when new error codes are added and need args
  K extends "NOTE_NOT_FOUND"
    ? [noteId: string]
    : K extends "VALIDATION_ERROR"
      ? [issues: $ZodError["issues"]]
      : K extends "JSON_PARSE_ERROR"
        ? [message: unknown]
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
  FORBIDDEN: () => ({ code: "FORBIDDEN" }),
  DB_ERROR: () => ({ code: "DB_ERROR" }),
  VALIDATION_ERROR: (issues: $ZodError["issues"]) => ({ code: "VALIDATION_ERROR", issues }),
  JSON_PARSE_ERROR: (message: unknown) => ({ code: "JSON_PARSE_ERROR", message }),
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

// HTTP mapping
export function appErrorToHttp(error: AppError) {
  const meta = ERROR_HTTP_MAP[error.code];

  return {
    status: meta.status,
    body: error,
  };
}
