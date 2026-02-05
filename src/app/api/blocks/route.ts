import { createBlockSchema } from "@/lib/db/validators";
import { createBlock } from "@/lib/db/blocks";
import { andThenAsync } from "@/lib/result";
import { appErrorToHttp } from "@/lib/server/errors";
import { safeJsonParse } from "@/lib/server/utils";

export async function POST(request: Request) {
  const parsed = await safeJsonParse(request, createBlockSchema);
  const result = await andThenAsync(parsed, (data) =>
    createBlock({
      userId: process.env.STUB_USER_ID!,
      noteId: data.noteId,
      type: data.type,
      position: data.position,
      contentJson: data.contentJson,
      plainText: data.plainText,
    }),
  );

  if (!result.ok) {
    const { status, body } = appErrorToHttp(result.error);
    return Response.json(body, { status });
  }

  return Response.json({ ok: true, ...result.value });
}
