import { toHttp } from "@/lib/server/errors";
import { createNoteSchema, deleteNoteSchema } from "@/lib/db/validators";
import { createNote, deleteNote } from "@/lib/db/notes";
import { Errors } from "@/lib/server/errors";

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
  const input = deleteNoteSchema.safeParse(body);

  if (!input.success) {
    const { status, body } = toHttp(Errors.validation(input.error.issues));
    return Response.json(body, { status });
  }

  const deleteResult = await deleteNote({
    userId: process.env.STUB_USER_ID!,
    noteId: input.data.noteId,
  });

  if (!deleteResult.ok) {
    const { status, body } = toHttp(deleteResult.error);
    return Response.json(body, { status });
  }

  return Response.json({ ok: true, note: deleteResult.value });
}
