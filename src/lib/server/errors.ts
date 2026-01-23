import "server-only";
import { Errors, isAppError, type AppError, type AppErrorCode } from "@/lib/errors";
import { isInternalError, type InternalError } from "@/lib/server/internal-errors";

type HttpErrorMeta = {
  status: number;
  message?: string;
};

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
  RESPONSE_PARSE_ERROR: { status: 502 },
} satisfies Record<AppErrorCode, HttpErrorMeta>;

export function sanitizeError(error: AppError | InternalError): AppError {
  if (isAppError(error)) return error;

  if (isInternalError(error)) {
    switch (error.code) {
      /* case "INTERNAL_RATE_LIMITED":
        return Errors.DB_ERROR();
      case "INTERNAL_DEPENDENCY_FAILURE":
        return Errors.DB_ERROR();
      case "INTERNAL_LOGIC_ERROR":
        return Errors.DB_ERROR(); */
      default: {
        return Errors.DB_ERROR();
      }
    }
  }

  return Errors.DB_ERROR();
}

// HTTP mapping
export function appErrorToHttp(error: AppError | InternalError) {
  const publicError = sanitizeError(error);
  const meta = ERROR_HTTP_MAP[publicError.code];

  return {
    status: meta.status,
    body: publicError,
  };
}
