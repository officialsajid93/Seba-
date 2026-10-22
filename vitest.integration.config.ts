import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // "server-only" throws outside React Server Components; tests run server code directly.
      "server-only": path.resolve(__dirname, "tests/unit/server-only-stub.ts"),
    },
  },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 20_000,
    environment: "node",
  },
});
