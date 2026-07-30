import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // Browser-based render tests live in their own config (vitest.render.config.ts)
    // so this suite stays fast and needs no Chromium. Run them with `npm run test:render`.
    exclude: ["tests/render/**"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
