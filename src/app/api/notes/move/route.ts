import { moveNoteSchema } from "@/lib/db/validators";
import { moveNote } from "@/lib/db/notes";
import { andThenAsync } from "@/lib/result";
import { appErrorToHttp } from "@/lib/server/errors";
import { safeJsonParse } from "@/lib/server/utils";
import { verifyAuthToken } from "@/lib/server/auth";

export async function PUT(request: Request) {
  const authResult = await verifyAuthToken(request);
  if (!authResult.ok) {
    const { status, body } = appErrorToHttp(authResult.error);
    return Response.json(body, { status });
  }
  const userId = authResult.value;

  const parsed = await safeJsonParse(request, moveNoteSchema);
  const result = await andThenAsync(parsed, (data) =>
    moveNote({
      userId,
      noteId: data.noteId,
      newParentId: data.newParentId,
      beforeId: data.beforeId ?? null,
      afterId: data.afterId ?? null,
    }),
  );

  if (!result.ok) {
    const { status, body } = appErrorToHttp(result.error);
    return Response.json(body, { status });
  }
  return Response.json({ ok: true, ...result.value });
}
