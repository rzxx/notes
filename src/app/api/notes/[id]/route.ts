import { getNoteById, renameNote } from "@/lib/db/notes";
import { noteIdParamSchema, updateNoteSchema } from "@/lib/db/validators";
import { andThenAsync } from "@/lib/result";
import { appErrorToHttp } from "@/lib/server/errors";
import { safeJsonParse, safeParseToResult } from "@/lib/server/utils";

type RouteContext = {
  params: { id: string };
};

export async function GET(_request: Request, context: RouteContext) {
  const parsed = safeParseToResult(noteIdParamSchema, await Promise.resolve(context.params));
  const result = await andThenAsync(parsed, (data) =>
    getNoteById({ userId: process.env.STUB_USER_ID!, noteId: data.id }),
  );

  if (!result.ok) {
    const { status, body } = appErrorToHttp(result.error);
    return Response.json(body, { status });
  }

  return Response.json({ ok: true, ...result.value });
}

export async function PUT(request: Request, context: RouteContext) {
  const parsedParams = safeParseToResult(noteIdParamSchema, await Promise.resolve(context.params));
  const parsedBody = await safeJsonParse(request, updateNoteSchema);
  const result = await andThenAsync(parsedParams, (params) =>
    andThenAsync(parsedBody, (body) =>
      renameNote({
        userId: process.env.STUB_USER_ID!,
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
