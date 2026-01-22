import "server-only";

export type AppError =
  | { code: "NOTE_NOT_FOUND"; noteId: string }
  | { code: "FORBIDDEN" }
  | { code: "DB_ERROR" };

export const Errors = {
  noteNotFound: (noteId: string): AppError => ({ code: "NOTE_NOT_FOUND", noteId }),
  forbidden: (): AppError => ({ code: "FORBIDDEN" }),
  db: (): AppError => ({ code: "DB_ERROR" }),
} as const;

export function isAppError(x: unknown): x is AppError {
  if (typeof x !== "object" || x === null) return false;
  if (!("code" in x)) return false;
  const code = (x as { code: unknown }).code;
  return code === "NOTE_NOT_FOUND" || code === "FORBIDDEN" || code === "DB_ERROR";
}

function assertNever(x: never): never {
  throw new Error("Unhandled AppError: " + JSON.stringify(x));
}

export function toHttp(err: AppError): { status: number; body: { error: AppError } } {
  switch (err.code) {
    case "NOTE_NOT_FOUND":
      return { status: 404, body: { error: err } };
    case "FORBIDDEN":
      return { status: 403, body: { error: err } };
    case "DB_ERROR":
      return { status: 500, body: { error: err } };
    default:
      return assertNever(err);
  }
}
