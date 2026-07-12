import { defineConfig } from "drizzle-kit";

import { dbEnv } from "./src/env";

/**
 * Drizzle Kit config used by `pnpm db:generate` (emit SQL) and `pnpm db:push` (apply).
 */
export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: dbEnv.databaseUrl },
});
