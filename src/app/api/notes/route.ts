import { createNoteSchema, deleteNoteSchema, getNoteListSchema } from "@/lib/db/validators";
import { createNote, deleteNote, getNotesList } from "@/lib/db/notes";
import { andThenAsync } from "@/lib/result";
import { safeJsonParse, safeParseToResult } from "@/lib/server/utils";
import { appErrorToHttp } from "@/lib/server/errors";
import { verifyAuthToken } from "@/lib/server/auth";

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if (!authResult.ok) {
    const { status, body } = appErrorToHttp(authResult.error);
    return Response.json(body, { status });
  }
  const userId = authResult.value;

  const url = new URL(request.url);
  const parentIdParam = url.searchParams.get("parentId");
  const limitParam = url.searchParams.get("limit");
  const cursorParam = url.searchParams.get("cursor");

  const parsed = safeParseToResult(getNoteListSchema, {
    parentId: parentIdParam === null || parentIdParam === "null" ? null : parentIdParam,
    limit: limitParam ? Number(limitParam) : undefined,
    cursor: cursorParam ?? undefined,
  });

  const result = await andThenAsync(parsed, (data) =>
    getNotesList({
      userId,
      parentId: data.parentId,
      limit: data.limit,
      cursor: data.cursor,
    }),
  );

  if (!result.ok) {
    const { status, body } = appErrorToHttp(result.error);
    return Response.json(body, { status });
  }
  return Response.json({ ok: true, ...result.value });
}

export async function POST(request: Request) {
  const authResult = await verifyAuthToken(request);
  if (!authResult.ok) {
    const { status, body } = appErrorToHttp(authResult.error);
    return Response.json(body, { status });
  }
  const userId = authResult.value;

  const parsed = await safeJsonParse(request, createNoteSchema);
  const result = await andThenAsync(parsed, (data) =>
    createNote({
      userId,
      parentId: data.parentId,
      title: data.title,
    }),
  );

  if (!result.ok) {
    const { status, body } = appErrorToHttp(result.error);
    return Response.json(body, { status });
  }
  return Response.json({ ok: true, note: result.value });
}

export async function DELETE(request: Request) {
  const authResult = await verifyAuthToken(request);
  if (!authResult.ok) {
    const { status, body } = appErrorToHttp(authResult.error);
    return Response.json(body, { status });
  }
  const userId = authResult.value;

  const parsed = await safeJsonParse(request, deleteNoteSchema);
  const result = await andThenAsync(parsed, (data) =>
    deleteNote({
      userId,
      noteId: data.noteId,
    }),
  );

  if (!result.ok) {
    const { status, body } = appErrorToHttp(result.error);
    return Response.json(body, { status });
  }
  return Response.json({ ok: true, note: result.value });
}
