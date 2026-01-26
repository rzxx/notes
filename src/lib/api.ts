import { AppErrorSchema, Errors, type AppError } from "@/lib/errors";
import { Err, Ok, andThen, andThenAsync, type Result } from "@/lib/result";

const toResponse = async (
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Result<Response, AppError>> =>
  fetch(input, init)
    .then(Ok)
    .catch((error) =>
      Err(
        Errors.RESPONSE_PARSE_ERROR(0, { message: error instanceof Error ? error.message : error }),
      ),
    );

const readText = async (response: Response): Promise<Result<string, AppError>> =>
  response
    .text()
    .then(Ok)
    .catch((error) =>
      Err(
        Errors.RESPONSE_PARSE_ERROR(response.status, {
          message: error instanceof Error ? error.message : error,
        }),
      ),
    );

const parsePayload = (raw: string): Result<unknown, AppError> => {
  if (!raw) return Ok(null);
  try {
    return Ok(JSON.parse(raw));
  } catch {
    return Ok(raw);
  }
};

const toAppErrorOrOk =
  <T>(response: Response) =>
  (payload: unknown): Result<T, AppError> => {
    if (!response.ok) {
      const parsedError = AppErrorSchema.safeParse(payload);
      return parsedError.success
        ? Err(parsedError.data)
        : Err(Errors.RESPONSE_PARSE_ERROR(response.status, payload));
    }

    return Ok(payload as T);
  };

export async function fetchResult<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Result<T, AppError>> {
  const responseResult = await toResponse(input, init);
  const textResult = await andThenAsync(responseResult, readText);
  const payloadResult = andThen(textResult, parsePayload);

  return andThenAsync(responseResult, async (response) =>
    andThenAsync(payloadResult, async (payload) => toAppErrorOrOk<T>(response)(payload)),
  );
}

export async function fetchResultWithTimeout<T>(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  timeoutMs: number,
): Promise<Result<T, AppError>> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort("timeout"), timeoutMs);

  try {
    return await fetchResult<T>(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}
