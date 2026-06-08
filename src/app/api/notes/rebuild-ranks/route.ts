import { rebuildRanks } from "@/lib/db/notes";
import { andThenAsync } from "@/lib/result";
import { appErrorToHttp } from "@/lib/server/errors";
import { safeJsonParse } from "@/lib/server/utils";
import { verifyAuthToken } from "@/lib/server/auth";
import { z } from "zod";

const rebuildRanksSchema = z.unknown();

export async function POST(request: Request) {
  const authResult = await verifyAuthToken(request);
  if (!authResult.ok) {
    const { status, body } = appErrorToHttp(authResult.error);
    return Response.json(body, { status });
  }
  const userId = authResult.value;

  const parsed = await safeJsonParse(request, rebuildRanksSchema);
  const result = await andThenAsync(parsed, () =>
    rebuildRanks({
      userId,
    }),
  );

  if (!result.ok) {
    const { status, body } = appErrorToHttp(result.error);
    return Response.json(body, { status });
  }
  return Response.json({ ok: true, rebuiltRanks: result.value });
}
