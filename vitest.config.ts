import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));

/**
 * Test harness (Phase 5). Node environment; tests live in tests/.
 * The "@" alias mirrors tsconfig paths so tests import app modules the same way.
 */
export default defineConfig({
  resolve: { alias: { "@": root } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
