import { mergeBlocksSchema } from "@/lib/db/validators";
import { mergeBlocks } from "@/lib/db/blocks";
import { andThenAsync } from "@/lib/result";
import { appErrorToHttp } from "@/lib/server/errors";
import { safeJsonParse } from "@/lib/server/utils";

export async function PUT(request: Request) {
  const parsed = await safeJsonParse(request, mergeBlocksSchema);
  const result = await andThenAsync(parsed, (data) =>
    mergeBlocks({
      userId: process.env.STUB_USER_ID!,
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
