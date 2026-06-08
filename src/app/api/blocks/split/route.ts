import { splitBlockSchema } from "@/lib/db/validators";
import { splitBlock } from "@/lib/db/blocks";
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

  const parsed = await safeJsonParse(request, splitBlockSchema);
  const result = await andThenAsync(parsed, (data) =>
    splitBlock({
      userId,
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
