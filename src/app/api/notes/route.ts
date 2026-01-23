import { createNoteSchema, deleteNoteSchema } from "@/lib/db/validators";
import { createNote, deleteNote } from "@/lib/db/notes";
import { andThenAsync, safeParseToResult } from "@/lib/result";
import { appErrorToHttp } from "@/lib/server/errors";

export async function GET(request: Request) {
  return new Response("Notes API is working");
}

export async function POST(request: Request) {
  const body = await request.json();
  const input = createNoteSchema.parse(body);

  const createdNote = await createNote({
    userId: process.env.STUB_USER_ID!,
    parentId: input.parentId,
    title: input.title,
  });

  return Response.json({ ok: true, note: createdNote });
}

export async function DELETE(request: Request) {
  const body = await request.json();

  const result = await andThenAsync(safeParseToResult(deleteNoteSchema, body), (data) =>
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
