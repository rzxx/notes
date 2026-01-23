import { rebuildClosure } from "@/lib/db/notes";
import { andThenAsync } from "@/lib/result";
import { appErrorToHttp } from "@/lib/server/errors";
import { safeJsonParse } from "@/lib/server/utils";
import { z } from "zod";

const rebuildClosureSchema = z.unknown();

export async function POST(request: Request) {
  // using stub user id for simplicity, so body is not needed now
  const parsed = await safeJsonParse(request, rebuildClosureSchema);
  const result = await andThenAsync(parsed, () =>
    rebuildClosure({
      userId: process.env.STUB_USER_ID!,
    }),
  );

  if (!result.ok) {
    const { status, body } = appErrorToHttp(result.error);
    return Response.json(body, { status });
  }
  return Response.json({ ok: true, rebuiltClosureTables: result.value });
}
