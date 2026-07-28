import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.tsx", "src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage",
      include: ["src/**/*.tsx", "src/**/*.ts"],
      exclude: ["src/**/*.test.tsx", "src/**/*.test.ts", "src/test/**", "src/**/index.ts"],
      reporter: ["text", "lcov", "json-summary"],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 75,
        statements: 85,
      },
    },
  },
});
