import "server-only";
import { z } from "zod";
import { Errors, type AppError } from "@/lib/errors";
import { Result, Ok, Err } from "@/lib/result";

export function safeParseToResult<T>(schema: z.ZodType<T>, data: unknown): Result<T, AppError> {
  const result = schema.safeParse(data);
  return result.success ? Ok(result.data) : Err(Errors.VALIDATION_ERROR(result.error.issues));
}

// Async version of safeParseToResult - toggle if needed in the future
/* export async function safeParseAsyncToResult<T>(
  schema: z.ZodType<T>,
  data: unknown,
): Promise<Result<T, AppError>> {
  const result = await schema.safeParseAsync(data);
  return result.success ? Ok(result.data) : Err(Errors.validation(result.error.issues));
} */

export async function safeJsonParse<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<Result<T, AppError>> {
  // enforce JSON content type
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return Err(Errors.UNSUPPORTED_CONTENT_TYPE(contentType));
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch (cause: unknown) {
    if (cause instanceof SyntaxError && cause.message.includes("Unexpected end of JSON")) {
      return Err(Errors.JSON_EMPTY_BODY());
    }
    const message = cause instanceof Error ? cause.message : String(cause);

    return Err(Errors.JSON_PARSE_ERROR(message));
  }

  return safeParseToResult(schema, body);
}

export function parseCursor(cursor?: string): Result<{ createdAt: Date; id: string }, AppError> {
  if (!cursor) return Err(Errors.CURSOR_PARSE_ERROR());
  const [createdAtRaw, id] = cursor.split("|");
  if (!createdAtRaw || !id) return Err(Errors.CURSOR_PARSE_ERROR());

  const createdAtMs = Number(createdAtRaw);
  if (!Number.isFinite(createdAtMs)) return Err(Errors.CURSOR_PARSE_ERROR());
  const createdAt = new Date(createdAtMs);
  if (Number.isNaN(createdAt.getTime())) return Err(Errors.CURSOR_PARSE_ERROR());

  const idCheck = z.uuid().safeParse(id);
  if (!idCheck.success) return Err(Errors.VALIDATION_ERROR(idCheck.error.issues));
  return Ok({ createdAt, id });
}
