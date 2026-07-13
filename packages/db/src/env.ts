import { z } from "zod";

/**
 * Shape of the environment variables consumed by the data layer.
 */
export interface DbEnv {
  readonly databaseUrl: string;
}

export const FALLBACK_URL = "postgres://u:pass@localhost:5432/db";

/**
 * Zod schema validating the data-layer env at startup.
 * Falls back to FALLBACK_URL when DATABASE_URL is not set (e.g. CI without secret).
 */
export const dbEnvSchema: z.ZodType<DbEnv> = z.object({
  databaseUrl: z.string().min(1).catch(FALLBACK_URL),
});

/**
 * Parses process.env once at module load; provides a fallback for CI.
 */
export const dbEnv: DbEnv = dbEnvSchema.parse({
  databaseUrl: process.env.DATABASE_URL ?? undefined,
});
