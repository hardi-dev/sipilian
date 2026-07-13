import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

const fileEnv = loadEnv("test", "../../", "");

export default defineConfig({
  test: {
    env: {
      DATABASE_URL: process.env.DATABASE_URL ?? fileEnv.DATABASE_URL ?? "",
    },
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/index.ts",
        "src/test-support.ts",
        "src/context.ts",
        "src/**/*.schema.ts",
      ],
      thresholds: { lines: 80, functions: 80, branches: 75, statements: 80 },
    },
  },
});
