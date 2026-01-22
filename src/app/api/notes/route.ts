import { createNoteSchema, deleteNoteSchema } from "@/lib/db/validators";
import { createNote, deleteNote } from "@/lib/db/notes";

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
  const input = deleteNoteSchema.parse(body);

  const deletedNote = await deleteNote({
    userId: process.env.STUB_USER_ID!,
    noteId: input.noteId,
  });

  return Response.json({ ok: true, note: deletedNote });
}
