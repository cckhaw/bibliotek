import { defineConfig } from "vitest/config";
import path from "node:path";

// Needs a migrated Postgres (see README). Run with: npm run test:int
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: { include: ["tests/integration/**/*.test.ts"], fileParallelism: false, testTimeout: 30_000, hookTimeout: 30_000 },
});
