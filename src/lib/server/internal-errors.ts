import "server-only";
import { z } from "zod";

const InternalErrorBase = z.object({
  meta: z.record(z.string(), z.unknown()).optional(),
});

export const InternalErrorSchema = z.discriminatedUnion("code", [
  InternalErrorBase.extend({
    code: z.literal("INTERNAL_RATE_LIMITED"),
  }),
  // Examples for future internal errors:
  /* InternalErrorBase.extend({
    code: z.literal("INTERNAL_LOGIC_ERROR"),
    reason: z.string().optional(),
  }),
  InternalErrorBase.extend({
    code: z.literal("INTERNAL_DEPENDENCY_FAILURE"),
    service: z.string(),
    detail: z.unknown().optional(),
  }), */
]);

export type InternalError = z.infer<typeof InternalErrorSchema>;
export type InternalErrorCode = InternalError["code"];

type InternalErrorCtorArgs<K extends InternalErrorCode> = K extends "INTERNAL_RATE_LIMITED"
  ? [meta?: Record<string, unknown>]
  : // Examples for future internal errors:
    /* : K extends "INTERNAL_LOGIC_ERROR"
    ? [reason?: string, meta?: Record<string, unknown>]
    : K extends "INTERNAL_DEPENDENCY_FAILURE"
      ? [service: string, detail?: unknown, meta?: Record<string, unknown>] */
    [];

type InternalErrorCtors = {
  [K in InternalErrorCode]: (
    ...args: InternalErrorCtorArgs<K>
  ) => Extract<InternalError, { code: K }>;
};

export const InternalErrors = {
  INTERNAL_RATE_LIMITED: (meta?: Record<string, unknown>) => ({
    code: "INTERNAL_RATE_LIMITED",
    meta,
  }),
  // Examples for future internal errors:
  /* INTERNAL_LOGIC_ERROR: (reason?: string, meta?: Record<string, unknown>) => ({
    code: "INTERNAL_LOGIC_ERROR",
    reason,
    meta,
  }),
  INTERNAL_DEPENDENCY_FAILURE: (
    service: string,
    detail?: unknown,
    meta?: Record<string, unknown>,
  ) => ({
    code: "INTERNAL_DEPENDENCY_FAILURE",
    service,
    detail,
    meta,
  }), */
} satisfies InternalErrorCtors;

export function isInternalError(x: unknown): x is InternalError {
  return InternalErrorSchema.safeParse(x).success;
}
