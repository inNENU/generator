import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "istanbul",
      reporter: ["text", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.ts"],
      exclude: ["src/typings.ts", "src/component-schema.ts"],
      // Keep the current baseline from regressing; raise these as tests are added.
      thresholds: {
        branches: 57,
        functions: 66,
        lines: 74,
        statements: 73,
      },
    },
  },
});
