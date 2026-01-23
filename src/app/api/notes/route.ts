import { createNoteSchema, deleteNoteSchema } from "@/lib/db/validators";
import { createNote, deleteNote } from "@/lib/db/notes";
import { andThenAsync } from "@/lib/result";
import { safeJsonParse } from "@/lib/server/utils";
import { appErrorToHttp } from "@/lib/server/errors";

export async function GET(/* request: Request */) {
  return new Response("Notes API is working");
}

export async function POST(request: Request) {
  const parsed = await safeJsonParse(request, createNoteSchema);
  const result = await andThenAsync(parsed, (data) =>
    createNote({
      userId: process.env.STUB_USER_ID!,
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
  const parsed = await safeJsonParse(request, deleteNoteSchema);
  const result = await andThenAsync(parsed, (data) =>
    deleteNote({
      userId: process.env.STUB_USER_ID!,
      noteId: data.noteId,
    }),
  );

  if (!result.ok) {
    const { status, body } = appErrorToHttp(result.error);
    return Response.json(body, { status });
  }
  return Response.json({ ok: true, note: result.value });
}
