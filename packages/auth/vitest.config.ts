import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

const fileEnv = loadEnv("test", "../../", "") as Record<string, string>;

export default defineConfig({
  test: {
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ?? fileEnv.DATABASE_URL ?? "postgresql://u:pass@localhost:5432/db",
      BETTER_AUTH_SECRET:
        process.env.BETTER_AUTH_SECRET ?? fileEnv.BETTER_AUTH_SECRET ?? "x".repeat(32),
      BETTER_AUTH_URL:
        process.env.BETTER_AUTH_URL ?? fileEnv.BETTER_AUTH_URL ?? "http://localhost:3000",
      TRUSTED_ORIGINS:
        process.env.TRUSTED_ORIGINS ??
        fileEnv.TRUSTED_ORIGINS ??
        "http://localhost:3000,sipilian://",
    },
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/index.ts", "src/client-web.ts"],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
