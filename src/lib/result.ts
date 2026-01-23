import type { z } from "zod";
import { Errors, type AppError } from "./server/errors";

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export const Ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const Err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export const map = <A, B, E>(r: Result<A, E>, f: (a: A) => B): Result<B, E> =>
  r.ok ? Ok(f(r.value)) : r;

export const mapErr = <T, E, F>(r: Result<T, E>, f: (e: E) => F): Result<T, F> =>
  r.ok ? r : Err(f(r.error));

export const andThen = <A, B, E>(r: Result<A, E>, f: (a: A) => Result<B, E>): Result<B, E> =>
  r.ok ? f(r.value) : r;

export const andThenAsync = async <A, B, E>(
  r: Result<A, E>,
  f: (a: A) => Promise<Result<B, E>>,
): Promise<Result<B, E>> => (r.ok ? await f(r.value) : r);

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
