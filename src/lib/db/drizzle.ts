import "server-only";

import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";
import { relations } from "./relations";

const sql = neon(process.env.DATABASE_URL!);

export const db = drizzle({ client: sql, schema, relations });
export { schema };
