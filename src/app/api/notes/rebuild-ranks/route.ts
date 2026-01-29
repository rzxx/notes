import { rebuildRanks } from "@/lib/db/notes";
import { andThenAsync } from "@/lib/result";
import { appErrorToHttp } from "@/lib/server/errors";
import { safeJsonParse } from "@/lib/server/utils";
import { z } from "zod";

const rebuildRanksSchema = z.unknown();

export async function POST(request: Request) {
  // using stub user id for simplicity, so body is not needed now
  const parsed = await safeJsonParse(request, rebuildRanksSchema);
  const result = await andThenAsync(parsed, () =>
    rebuildRanks({
      userId: process.env.STUB_USER_ID!,
    }),
  );

  if (!result.ok) {
    const { status, body } = appErrorToHttp(result.error);
    return Response.json(body, { status });
  }
  return Response.json({ ok: true, rebuiltRanks: result.value });
}
