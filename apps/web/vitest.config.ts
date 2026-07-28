import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage",
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.test.tsx",
        "src/test/**",
        "src/app/**",         // Next.js page/layout files — covered by E2E
        "src/auth.ts",        // Auth.js adapter config — tested via integration
        "src/auth.config.ts",
      ],
      reporter: ["text", "lcov", "json-summary"],
      thresholds: {
        lines: 75,
        functions: 75,
        branches: 65,
        statements: 75,
      },
    },
  },
});
