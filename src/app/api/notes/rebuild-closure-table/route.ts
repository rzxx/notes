import { rebuildClosure } from "@/lib/db/notes";
import { appErrorToHttp } from "@/lib/server/errors";

export async function POST(request: Request) {
  // using stub user id for simplicity, so body is not needed now
  const body = await request.json();

  const result = await rebuildClosure({
    userId: process.env.STUB_USER_ID!,
  });

  if (!result.ok) {
    const { status, body } = appErrorToHttp(result.error);
    return Response.json(body, { status });
  }
  return Response.json({ ok: true, rebuiltClosureTables: result.value });
}
