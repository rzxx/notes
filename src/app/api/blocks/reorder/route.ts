import { reorderBlocksSchema } from "@/lib/db/validators";
import { reorderBlocks } from "@/lib/db/blocks";
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

  const parsed = await safeJsonParse(request, reorderBlocksSchema);
  const result = await andThenAsync(parsed, (data) =>
    reorderBlocks({
      userId,
      noteId: data.noteId,
      blockId: data.blockId,
      beforeId: data.beforeId,
      afterId: data.afterId,
    }),
  );

  if (!result.ok) {
    const { status, body } = appErrorToHttp(result.error);
    return Response.json(body, { status });
  }

  return Response.json({ ok: true, ...result.value });
}
