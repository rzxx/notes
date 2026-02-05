import { splitBlockSchema } from "@/lib/db/validators";
import { splitBlock } from "@/lib/db/blocks";
import { andThenAsync } from "@/lib/result";
import { appErrorToHttp } from "@/lib/server/errors";
import { safeJsonParse } from "@/lib/server/utils";

export async function PUT(request: Request) {
  const parsed = await safeJsonParse(request, splitBlockSchema);
  const result = await andThenAsync(parsed, (data) =>
    splitBlock({
      userId: process.env.STUB_USER_ID!,
      blockId: data.blockId,
      beforeText: data.beforeText,
      afterText: data.afterText,
    }),
  );

  if (!result.ok) {
    const { status, body } = appErrorToHttp(result.error);
    return Response.json(body, { status });
  }

  return Response.json({ ok: true, ...result.value });
}
