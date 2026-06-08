import { mergeBlocksSchema } from "@/lib/db/validators";
import { mergeBlocks } from "@/lib/db/blocks";
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

  const parsed = await safeJsonParse(request, mergeBlocksSchema);
  const result = await andThenAsync(parsed, (data) =>
    mergeBlocks({
      userId,
      prevBlockId: data.prevBlockId,
      currentBlockId: data.currentBlockId,
      mergedText: data.mergedText,
    }),
  );

  if (!result.ok) {
    const { status, body } = appErrorToHttp(result.error);
    return Response.json(body, { status });
  }

  return Response.json({ ok: true, ...result.value });
}
