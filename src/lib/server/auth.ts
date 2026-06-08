import "server-only";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { Errors, type AppError } from "@/lib/errors";
import { Ok, Err, type Result } from "@/lib/result";

const SHOO_BASE_URL = process.env.SHOO_BASE_URL || "https://shoo.dev";
const SHOO_ISSUER = process.env.SHOO_ISSUER || "https://shoo.dev";
const APP_ORIGIN = process.env.APP_ORIGIN || "http://localhost:3000";

const jwks = createRemoteJWKSet(new URL("/.well-known/jwks.json", SHOO_BASE_URL));

export async function verifyAuthToken(request: Request): Promise<Result<string, AppError>> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return Err(Errors.UNAUTHORIZED());
  }

  const idToken = authHeader.slice(7);
  if (!idToken) {
    return Err(Errors.UNAUTHORIZED());
  }

  try {
    const audience = `origin:${new URL(APP_ORIGIN).origin}`;
    const { payload } = await jwtVerify(idToken, jwks, {
      issuer: SHOO_ISSUER,
      audience,
    });

    if (typeof payload.pairwise_sub !== "string") {
      return Err(Errors.UNAUTHORIZED());
    }

    return Ok(payload.pairwise_sub);
  } catch {
    return Err(Errors.UNAUTHORIZED());
  }
}
