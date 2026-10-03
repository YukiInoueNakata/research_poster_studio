// Unit tests (npm test). Tests import the workspace packages from source, so no
// build is needed; the CLI/HTML-level checks stay in scripts/smoke-*.mjs.
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const src = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@rps\/core\/node$/, replacement: src("./packages/core/src/node.ts") },
      { find: /^@rps\/core$/, replacement: src("./packages/core/src/index.ts") },
      { find: /^@rps\/renderer$/, replacement: src("./packages/renderer/src/index.ts") },
    ],
  },
  test: {
    include: ["packages/*/test/**/*.test.ts"],
    environment: "node",
  },
});
