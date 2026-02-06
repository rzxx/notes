import { rebuildBlockRanks } from "@/lib/db/blocks";
import { andThenAsync } from "@/lib/result";
import { appErrorToHttp } from "@/lib/server/errors";
import { safeJsonParse } from "@/lib/server/utils";
import { z } from "zod";

const rebuildBlockRanksSchema = z.object({
  noteId: z.uuid().optional(),
});

export async function POST(request: Request) {
  const parsed = await safeJsonParse(request, rebuildBlockRanksSchema);
  const result = await andThenAsync(parsed, (data) =>
    rebuildBlockRanks({
      userId: process.env.STUB_USER_ID!,
      noteId: data.noteId,
    }),
  );

  if (!result.ok) {
    const { status, body } = appErrorToHttp(result.error);
    return Response.json(body, { status });
  }

  return Response.json({ ok: true, rebuiltRanks: result.value });
}
