import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: {
      DATABASE_URL: "postgres://test:test@localhost:5432/test",
    },
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/index.ts", "src/schema/index.ts"],
      thresholds: {
        lines: 70,
        functions: 0,
        branches: 70,
        statements: 70,
      },
    },
  },
});
