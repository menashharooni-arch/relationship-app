import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Separate from vitest.config.ts on purpose.
//
// These tests drive a real headless browser: they are slower and they need
// Chromium installed (`npx playwright install chromium`). Keeping them out of the
// default `npm test` means the fast, dependency-free suite stays fast and
// dependency-free, and a machine without a browser can still run it.
//
// Run with: npm run test:render
export default defineConfig({
  test: {
    include: ["tests/render/**/*.test.ts"],
    environment: "node",
    // Chromium launch plus CSS compilation dominates the first test.
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
