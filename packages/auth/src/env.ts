import { z } from "zod";

/**
 * Shape of the environment consumed by the auth package.
 */
export interface AuthEnv {
  readonly secret: string;
  readonly baseUrl: string;
  readonly trustedOrigins: readonly string[];
}

const authEnvSchema = z.object({
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  TRUSTED_ORIGINS: z.string().min(1),
});

/**
 * Builds the typed auth environment from a raw env source; throws if invalid.
 * @param source - The raw environment record to validate.
 * @returns The validated, typed auth environment.
 */
export function buildAuthEnv(source: NodeJS.ProcessEnv): AuthEnv {
  const raw = authEnvSchema.parse({
    BETTER_AUTH_SECRET: source.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: source.BETTER_AUTH_URL,
    TRUSTED_ORIGINS: source.TRUSTED_ORIGINS,
  });

  return {
    secret: raw.BETTER_AUTH_SECRET,
    baseUrl: raw.BETTER_AUTH_URL,
    trustedOrigins: raw.TRUSTED_ORIGINS.split(",").map((origin) => origin.trim()),
  };
}

export const authEnv: AuthEnv = buildAuthEnv(process.env);
