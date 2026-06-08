import { getNoteById, renameNote } from "@/lib/db/notes";
import { noteIdParamSchema, updateNoteSchema } from "@/lib/db/validators";
import { andThenAsync } from "@/lib/result";
import { appErrorToHttp } from "@/lib/server/errors";
import { safeJsonParse, safeParseToResult } from "@/lib/server/utils";
import { verifyAuthToken } from "@/lib/server/auth";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const authResult = await verifyAuthToken(request);
  if (!authResult.ok) {
    const { status, body } = appErrorToHttp(authResult.error);
    return Response.json(body, { status });
  }
  const userId = authResult.value;

  const parsed = safeParseToResult(noteIdParamSchema, await context.params);
  const result = await andThenAsync(parsed, (data) => getNoteById({ userId, noteId: data.id }));

  if (!result.ok) {
    const { status, body } = appErrorToHttp(result.error);
    return Response.json(body, { status });
  }

  return Response.json({ ok: true, ...result.value });
}

export async function PUT(request: Request, context: RouteContext) {
  const authResult = await verifyAuthToken(request);
  if (!authResult.ok) {
    const { status, body } = appErrorToHttp(authResult.error);
    return Response.json(body, { status });
  }
  const userId = authResult.value;

  const parsedParams = safeParseToResult(noteIdParamSchema, await context.params);
  const parsedBody = await safeJsonParse(request, updateNoteSchema);
  const result = await andThenAsync(parsedParams, (params) =>
    andThenAsync(parsedBody, (body) =>
      renameNote({
        userId,
        noteId: params.id,
        title: body.title,
      }),
    ),
  );

  if (!result.ok) {
    const { status, body } = appErrorToHttp(result.error);
    return Response.json(body, { status });
  }

  return Response.json({ ok: true, ...result.value });
}
