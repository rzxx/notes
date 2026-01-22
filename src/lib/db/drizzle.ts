import "server-only";

import { drizzle } from "drizzle-orm/neon-serverless";
import { relations } from "./relations";

export const db = drizzle(process.env.DATABASE_URL!, { relations });
