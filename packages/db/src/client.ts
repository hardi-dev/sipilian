import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import { dbEnv } from "./env";

const sql = neon(dbEnv.databaseUrl);

/**
 * Single shared Neon HTTP Drizzle instance.
 * Any other module in the monorepo that needs the DB imports this symbol.
 */
export const db = drizzle({ client: sql });

/**
 * Convenience alias for the shared Drizzle instance's runtime type.
 */
export type Db = typeof db;
