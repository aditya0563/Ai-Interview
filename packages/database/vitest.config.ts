import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Integration tests hit a real PostgreSQL instance — run sequentially to
    // avoid inter-test transaction conflicts on shared schema objects.
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    // Give the DB time to respond; default 5 s is too tight for first query
    // after container start.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/**/index.ts"],
      reporter: ["text", "lcov", "json-summary"],
    },
  },
});
