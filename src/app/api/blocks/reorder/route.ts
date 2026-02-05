import { reorderBlocksSchema } from "@/lib/db/validators";
import { reorderBlocks } from "@/lib/db/blocks";
import { andThenAsync } from "@/lib/result";
import { appErrorToHttp } from "@/lib/server/errors";
import { safeJsonParse } from "@/lib/server/utils";

export async function PUT(request: Request) {
  const parsed = await safeJsonParse(request, reorderBlocksSchema);
  const result = await andThenAsync(parsed, (data) =>
    reorderBlocks({
      userId: process.env.STUB_USER_ID!,
      noteId: data.noteId,
      orderedBlockIds: data.orderedBlockIds,
    }),
  );

  if (!result.ok) {
    const { status, body } = appErrorToHttp(result.error);
    return Response.json(body, { status });
  }

  return Response.json({ ok: true, ...result.value });
}
