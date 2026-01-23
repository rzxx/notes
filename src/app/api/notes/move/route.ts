import { moveNoteSchema } from "@/lib/db/validators";
import { moveNote } from "@/lib/db/notes";
import { andThenAsync } from "@/lib/result";
import { appErrorToHttp } from "@/lib/server/errors";
import { safeJsonParse } from "@/lib/server/utils";

export async function PUT(request: Request) {
  const parsed = await safeJsonParse(request, moveNoteSchema);
  const result = await andThenAsync(parsed, (data) =>
    moveNote({
      userId: process.env.STUB_USER_ID!,
      noteId: data.noteId,
      newParentId: data.newParentId,
    }),
  );

  if (!result.ok) {
    const { status, body } = appErrorToHttp(result.error);
    return Response.json(body, { status });
  }
  return Response.json({ ok: true, ...result.value });
}
