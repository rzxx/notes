import { blockIdParamSchema, updateBlockSchema } from "@/lib/db/validators";
import { deleteBlock, updateBlock } from "@/lib/db/blocks";
import { andThenAsync } from "@/lib/result";
import { appErrorToHttp } from "@/lib/server/errors";
import { safeJsonParse, safeParseToResult } from "@/lib/server/utils";
import { verifyAuthToken } from "@/lib/server/auth";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PUT(request: Request, context: RouteContext) {
  const authResult = await verifyAuthToken(request);
  if (!authResult.ok) {
    const { status, body } = appErrorToHttp(authResult.error);
    return Response.json(body, { status });
  }
  const userId = authResult.value;

  const parsedParams = safeParseToResult(blockIdParamSchema, await context.params);
  const parsedBody = await safeJsonParse(request, updateBlockSchema);
  const result = await andThenAsync(parsedParams, (params) =>
    andThenAsync(parsedBody, (body) =>
      updateBlock({
        userId,
        blockId: params.id,
        type: body.type,
        contentJson: body.contentJson,
        plainText: body.plainText,
      }),
    ),
  );

  if (!result.ok) {
    const { status, body } = appErrorToHttp(result.error);
    return Response.json(body, { status });
  }

  return Response.json({ ok: true, ...result.value });
}

export async function DELETE(request: Request, context: RouteContext) {
  const authResult = await verifyAuthToken(request);
  if (!authResult.ok) {
    const { status, body } = appErrorToHttp(authResult.error);
    return Response.json(body, { status });
  }
  const userId = authResult.value;

  const parsed = safeParseToResult(blockIdParamSchema, await context.params);
  const result = await andThenAsync(parsed, (params) =>
    deleteBlock({ userId, blockId: params.id }),
  );

  if (!result.ok) {
    const { status, body } = appErrorToHttp(result.error);
    return Response.json(body, { status });
  }

  return Response.json({ ok: true, ...result.value });
}
