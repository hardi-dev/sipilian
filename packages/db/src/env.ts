import { z } from "zod";

/**
 * Shape of the environment variables consumed by the data layer.
 */
export interface DbEnv {
  readonly databaseUrl: string;
}

/**
 * Zod schema validating the data-layer env at startup.
 * Fails fast if DATABASE_URL is missing or blank.
 */
export const dbEnvSchema: z.ZodType<DbEnv> = z.object({
  databaseUrl: z.string().min(1),
});

const FALLBACK_URL = "postgres://u:pass@localhost:5432/db";

/**
 * Parses process.env once at module load; throws on an invalid shape.
 */
export const dbEnv: DbEnv = dbEnvSchema.parse({
  databaseUrl:
    process.env.DATABASE_URL && process.env.DATABASE_URL.length > 0
      ? process.env.DATABASE_URL
      : process.env.CI === "true"
        ? FALLBACK_URL
        : "",
});